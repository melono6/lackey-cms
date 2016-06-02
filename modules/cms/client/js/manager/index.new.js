/* eslint no-cond-assign:0, no-new:0 */
/* jslint browser:true, node:true, esnext:true */
'use strict';
/*
    Copyright 2016 Enigma Marketing Services Limited

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

       http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/
const
    lackey = require('core/client/js'),
    api = require('cms/client/js/api'),
    modal = require('core/client/js/modal'),
    emit = require('cms/client/js/emit'),
    treeParser = require('cms/shared/treeparser'),
    Repository = require('cms/client/js/manager/repository'),
    ChangeUI = require('cms/client/js/manager/change.ui.js'),
    StructureUI = require('cms/client/js/manager/structure.ui.js'),
    ViewabilityUI = require('cms/client/js/manager/visibility.ui.js'),
    Stack = require('cms/client/js/manager/stack');

let locale = 'en',
    defaultLocale = 'en';

/**
 * @module lackey-cms/modules/cms/client/manager
 */


/**
 * @class
 */
function Manager() {

    let self = this,
        overlay = lackey
        .hook('settings.overlay');

    Object.defineProperty(this, 'current', {
        /**
         * @property {Promise.<Object>}
         * @name Manager#current
         */
        get: function () {
            if (!this._current) {
                this._loadCurrent();
            }
            return this
                ._current
                .then((id) => self.repository.get('content', id));
        },
        enumerable: false
    });

    this.repository = new Repository();
    this.repository.on('changed', lackey.as(this.onChanged, this));
    this.repository.bubble(this, 'reset');

    this.stack = new Stack(this.repository);
    this.stack.on('transition', lackey.as(this.onStackChange, this));


    overlay.addEventListener('mousewheel', (e) => {
        if (e.srcElement === overlay) {
            let content = lackey.hook('iframe', top.document.body).contentDocument.body;
            content.scrollTop = (e.wheelDelta * -1) + content.scrollTop;
        }
    }, true);

    this.setupUI();

}

emit(Manager.prototype);

/**
 * Forces loading currently viewed document data
 * @private
 */
Manager.prototype._loadCurrent = function () {

    let loc = top.location.pathname.replace(/^\/admin/, '');

    if (loc === '') {
        loc = '/';
    }

    this._current = api
        .read('/cms/content?route=' + loc)
        .then((data) => data.data[0].id);
};

Manager.prototype.setAction = function (options) {
    let li = document.createElement('li'),
        a = document.createElement('a'),
        i = document.createElement('i');
    i.className = options.class;
    a.appendChild(i);
    li.appendChild(a);
    this._toolsNode.appendChild(li);
    li.addEventListener('click', options.handler, true);
};

/**
 * Gets content node
 * @param   {Number} contentId [[Description]]
 * @param   {String} path      [[Description]]
 * @param   {String|null} variant   [[Description]]
 * @param   {String|null} schema    [[Description]]
 * @returns {Promise.<Mixed>}} [[Description]]
 */
Manager.prototype.get = function (contentId, path, variant, schema) {
    return this.repository
        .get('content', contentId)
        .then((content) => {
            let source = treeParser.get(content.layout, path, variant, null, locale);
            if (!source && schema) {
                source = schema.newDoc();
            }
            return source;
        });
};

/**
 * Sets content node
 * @param   {Number} contentId
 * @param   {String} path
 * @param   {String} variant
 * @param   {Mixed} value
 * @returns {Promise}
 */
Manager.prototype.set = function (contentId, path, variant, value) {
    return this.update('content', contentId, function (content) {
        treeParser.set(content.layout, path, value, variant || '*', null, locale !== defaultLocale ? locale : '*');
    });
};

/**
 * Inserts before
 * @param   {Number} contentId
 * @param   {String} path
 * @param   {String} variant
 * @param   {Mixed} value
 * @returns {Promise}
 */
Manager.prototype.insertAfter = function (contentId, path, variant, value) {
    return this.update('content', contentId, function (content) {
        treeParser.insertAfter(content.layout, path, value, variant || '*', null, locale !== defaultLocale ? locale : '*');
    });
};


/**
 * Removes
 * @param   {Number} contentId
 * @param   {String} path
 * @param   {String} variant
 * @param   {Mixed} value
 * @returns {Promise}
 */
Manager.prototype.remove = function (contentId, path, variant) {
    return this.update('content', contentId, function (content) {
        treeParser.remove(content.layout, path, variant || '*', null, locale !== defaultLocale ? locale : '*');
    });
};

/**
 * Gets content node
 * @param   {Number} contentId [[Description]]
 * @param   {String} path      [[Description]]
 * @param   {String|null} variant   [[Description]]
 * @returns {Promise.<Mixed>}} [[Description]]
 */
Manager.prototype.getMedia = function (contentId) {
    return this.repository
        .get('media', contentId)
        .then((content) => {
            return content;
        });
};

Manager.prototype.preview = function () {
    let self = this;
    this
        .current
        .then((def) => {
            return self.repository.get('content', def.id);
        })
        .then((contents) => {
            let data = JSON.stringify({
                    location: ((a) => {
                        return a === '' ? '/' : a;
                    })(top.location.pathname.replace(/^\/admin/, '')),
                    contents: contents
                }),
                form = top.document.createElement('form'),
                input = top.document.createElement('input');
            form.method = 'post';
            form.action = '/cms/preview';
            form.target = '_preview';
            input.type = 'hidden';
            input.name = 'preview';
            input.value = data;
            form.appendChild(input);
            document.body.appendChild(form);
            form.submit();
            document.body.removeChild(form);
        });
};

/**
 * Handler for repository changes
 * @param {RepositoryEvent} event
 */
Manager.prototype.onChanged = function () {
    //
};

/**
 * Handler for stack change
 * @param {StackEvent} event
 */
Manager.prototype.onStackChange = function () {};

Manager.prototype.onViewStructure = function () {

    lackey.hook('header.settings').setAttribute('disabled', '');

    let
        self = this,
        promise;

    if (this.stack.length) {
        promise = this.stack.clear();
    } else {

        promise = this
            .current
            .then((current) => {

                let structureController = new StructureUI({
                    type: 'content',
                    id: current.id,
                    context: () => Promise.resolve(self.current),
                    stack: self.stack
                }, this.repository);
                structureController.on('changed', lackey.as(self.onStructureChange, self));
                return self.stack.inspectStructure(structureController);
            });
    }

    promise
        .then(() => {
            lackey.hook('header.settings').removeAttribute('disabled', '');
        });


};

Manager.prototype.onStructureChange = function () {
    this.repository.notify();
    this.preview();
};

Manager.prototype.onPagePropertiesChanged = function (event) {
    return this
        .updateCurrent(function (content) {
            content.props = event.data;
        })
        .then(lackey.as(this.preview, this));
};


Manager.prototype.update = function (type, id, handler) {
    let self = this;
    return this.repository
        .get(type, id)
        .then((content) => {
            handler(content);
            return self.repository.set(type, id, content);
        });
};

Manager.prototype.updateCurrent = function (handler) {
    return this.current
        .then((current) => {
            return this.update('content', current.id, handler);
        });
};

Manager.prototype.setupUI = function () {

    lackey.hook('header.settings').addEventListener('click', lackey.as(this.onViewStructure, this), true);
    this._changeUI = new ChangeUI(this.repository);
};


Manager.init = function () {
    lackey.manager = new Manager();
};

Manager.prototype.diff = function () {
    let self = this;
    lackey
        .select(['[data-lky-component="visual-diff"]'])
        .forEach((hook) => {
            hook.innerHTML = self.repository.visualDiff();
        });
};

module.exports = Manager;
