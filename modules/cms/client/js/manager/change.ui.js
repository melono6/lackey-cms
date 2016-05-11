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
const lackey = require('core/client/js'),
    template = require('core/client/js/template'),
    emit = require('cms/client/js/emit'),
    growl = require('cms/client/js/growl'),
      path = require('path');


/**
 * @module lackey-cms/modules/cms/client/manager
 */

/**
 * @constructs lackey-cms/modules/cms/client/manager/ChangeUI
 * @param {HTMLElement} parentNode
 * @param {Repository} repository
 * @param {Object}
 */
function ChangeUI(parentNode, repository) {

    this._nodes = [];
    this.repository = repository;

    template
        .render('cms/cms/header.actions')
        .then((nodes) => nodes.forEach((node) => {
            this._nodes.push(node);
            parentNode.appendChild(node);
        }))
        .then(lackey.as(this.bindUI, this, [parentNode]));
}

emit(ChangeUI.prototype);

ChangeUI.prototype.bindUI = function (parentNode) {
    this._save = lackey.hook('save', parentNode);
    this._cancel = lackey.hook('cancel', parentNode);
    this._changes = lackey.hook('changes', parentNode);
    this._changesList = lackey.hook('changes-list', parentNode);

    this._changeHandler = lackey.as(this.onChange, this);
    this.repository.on('changed', this._changeHandler);

    this._cancel.addEventListener('click', lackey.as(this.cancel, this), true);
    this._save.addEventListener('click', lackey.as(this.save, this), true);

    this.onChange();
};

ChangeUI.prototype.cancel = function (event) {
    event.stopPropagation();
    event.preventDefault();
    this.repository.reset(this._type, this._id);
};

ChangeUI.prototype.save = function (event) {
    event.stopPropagation();
    event.preventDefault();
    this
        .repository
        .saveAll()
        .then(() => {
            growl({
                status: 'success',
                message: 'Change have been saved!'
            });
        });
};

ChangeUI.prototype.onChange = function () {

    let self = this,
        diff = this.repository.diff(),
        keys = diff ? Object.keys(diff) : [],
        changesCount = keys.length;

    if (changesCount > 0) {
        this._changes.innerText = changesCount;
        this._changesList.innerHTML = '';
        keys.forEach((key) => {
            let li = document.createElement('li'),
                span = document.createElement('span'),
                button = document.createElement('button');

            self.repository.get(key)
                .then((object) => {
                    let label;
                    if(key.match(/^content-/)) {
                        label = 'Page: ';
                        if(object.props && object.props.title) {
                            label += object.props.title;
                        } else {
                            label += object.route;
                        }
                    } else if(object.type === 'image') {
                        label = 'Image: ' + path.basename(object.source);
                    } else if(object.type === 'video') {
                        label = 'Video: ' + path.basename(object.source);
                    } else {
                        label = 'Attacj,emt: ' + path.basename(object.source);
                    }

                    span.innerText = label;
                });
            button.innerText = 'Dismiss';

            li.appendChild(span);
            li.appendChild(button);
            this._changesList.appendChild(li);
        });
        this.uiUpdate('active', 'active', 'active');
    } else {
        this.uiUpdate('disabled', 'disabled', 'hidden');
    }
};

ChangeUI.prototype.uiUpdate = function (save, cancel, changes) {
    this.state(this._save, save);
    this.state(this._cancel, cancel);
    this.state(this._changes, changes);
    this.state(this._changesList, changes);
};

ChangeUI.prototype.state = function (element, state) {
    if (state === 'disabled') {
        element.setAttribute('disabled', '');
    } else {
        element.removeAttribute('disabled');
    }
    element.style.display = state === 'hidden' ? 'none' : '';
};

ChangeUI.prototype.destroy = function () {
    this.repository.off('changed', this._changeHandler);
    this._nodes.forEach((node) => {
        node.parentNode.removeChild(node);
    });
    delete this._nodes;
    delete this._changeHandler;
    delete this.repository;
};

module.exports = ChangeUI;
