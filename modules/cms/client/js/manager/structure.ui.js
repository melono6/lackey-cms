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
const emit = require('cms/client/js/emit'),
    lackey = require('core/client/js'),
    template = require('core/client/js/template'),
    modal = require('core/client/js/modal'),
    api = require('cms/client/js/api'),
    MediaModalController = require('cms/client/js/manager/media');

let cache = {};

function readTemplate(templatePath, index) {
    if (typeof templatePath === 'object') {
        return Promise.resolve(templatePath);
    }
    cache[templatePath] = cache[templatePath] || api
        .read('/cms/template?path=' + encodeURI(templatePath) + '&limit=1')
        .then((data) => {
            let ctx = {};
            if (data && data.data && data.data.length) {
                ctx = data.data[0];
            }
            return ctx;

        });

    return cache[templatePath]
        .then((ctx) => {
            ctx.$idx = index;
            return ctx;
        });
}

/**
 * Dust helper to pull Template data
 * @param   {Chunk} chunk
 * @param   {Context}    context
 * @param   {Object}   bodies
 * @param   {Object}   params
 * @param   {string}    params.template
 * @returns {Chunk}
 */
template.dust.helpers.templateData = function (chunk, context, bodies, params) {

    let templatePath = params.template,
        index = context.get('$idx');

    return chunk.map((injectedChunk) => {
        readTemplate(templatePath, index)
            .then((data) => {
                injectedChunk
                    .render(bodies.block, context.push(data))
                    .end();
            });
    });


};

/**
 * @module lackey-cms/modules/cms/client/manager
 */

/**
 * @constructs lackey-cms/modules/cms/client/manager/StructureUI
 * @param {HTMLElement} rootNode
 * @param {object}   vars
 * @param {object} vars.settings
 * @param {object} vars.context
 * @param {object} vars.content
 * @param {object} vars.expose
 * @param {object} vars.settingsDictionary
 * @param {function} vars.pullLatest
 */
function StructureUI(rootNode, vars) {

    this._node = rootNode;
    this._documentType = vars.type;
    this._documentId = vars.id;
    this._settings = vars.settings;
    this._dictionary = vars.settingsDictionary;
    this._context = vars.context;
    this._expose = vars.expose;
    this._stack = vars.stack;
    this.drawButtons(vars.settingsDictionary);
    this.drawSections();
    top.Lackey.manager.diff();

}

StructureUI.prototype.drawButtons = function () {

    // settings
    let section = lackey.select('[data-lky-section="meta"]', this._node)[0],
        self = this,
        dictionary,
        settings,
        context;

    section.style.display = 'none';

    this
        ._context()
        .then((ctx) => {
            context = ctx;
            return self._dictionary(context);
        })
        .then((dct) => {
            dictionary = dct;
            return self._settings(context);
        })
        .then((stgs) => {
            settings = stgs;

            if (!dictionary) {
                return;
            }

            section.style.display = '';
            return template
                .redraw(lackey.select('[data-lky-template="cms/cms/properties"]', section)[0], StructureUI.mapDictionary({
                    values: settings,
                    dictionary: dictionary
                }));
        })
        .then((nodes) => {
            nodes.forEach((node) => {
                lackey.select(['input', 'select'], node).forEach((input) => {
                    input.addEventListener('change', function () {
                        settings[input.name] = input.value;
                        self.emit('changed', settings);
                    }, true);
                });
            });
        });

};

StructureUI.mapDictionary = function (data) {
    data.dictionary = Object
        .keys(data.dictionary)
        .map((key) => {
            let value = data.dictionary[key];
            if (Array.isArray(value)) {
                return {
                    type: 'select',
                    name: key,
                    label: key,
                    items: value.map((item) => {
                        if (typeof item === 'string') {
                            return {
                                label: item,
                                value: item
                            };
                        }
                        item.label = item.label || item.value;
                        return item;
                    })
                };
            }
            return {
                label: key,
                name: key,
                type: value
            };
        });
    return data;
};


StructureUI.prototype.editMedia = function (event, hook) {
    event.stopPropagation();
    event.preventDefault();
    let self = this,
        path = hook.getAttribute('data-lky-path').replace(/^layout\./, '');

    lackey.manager
        .get(self._documentId, path)
        .then((media) => lackey.manager.getMedia(media.id))
        .then((content) => MediaModalController.open(content))
        .then((media) => {
            if (media) {
                lackey.manager.set(self._documentId, path, null, {
                    type: 'Media',
                    id: media.id
                });
                self.emit('changed');
            }
        });

};

StructureUI.prototype.addBlockController = (rootNode, vars, resolve) => {

    let OK = lackey.hook('ok', rootNode);
    OK.setAttribute('disabled', '');
    lackey.bind('input', 'change', () => {
        OK.removeAttribute('disabled');
    }, rootNode);
    OK.addEventListener('click', () => {
        let value = lackey
            .select('input', rootNode)
            .map((input) => input.checked ? input.value : null)
            .filter((val) => !!val)[0];
        resolve(value);
    });

};

StructureUI.prototype.addBlock = function (event, hook) {
    event.stopPropagation();
    event.preventDefault();
    let self = this,
        path = hook.getAttribute('data-lky-path').replace(/^layout\./, ''),
        pathParts = path.split('.'),
        parentPath = pathParts.slice(0, -1).join('.'),
        actualPath = parentPath + '.items.' + pathParts[pathParts.length - 1];

    this._blockDefs = this._blockDefs || api
        .read('/cms/template?type=block&limit=100')
        .then((r) => r.data);

    this._blockDefs
        .then((blocks) => {
            return modal.open('cms/cms/structure/block.picker', {
                blocks: blocks
            }, self.addBlockController);
        })
        .then((value) => {
            if (!value) {
                return;
            }
            return self
                .ensureList(parentPath)
                .then(() => {
                    return lackey.manager.insertAfter(self._documentId, actualPath, null, {
                            type: 'Block',
                            template: value,
                            fields: {}
                        })
                        .then(() => {

                            self.emit('changed');
                            self.drawSections();
                        });
                });
        });
};


StructureUI.prototype.ensureList = function (path) {
    return lackey.manager
        .get(this._documentId, path)
        .then((list) => {
            if (!list) {
                return lackey.manager.set(this._documentId, path, '*', {
                    type: 'List',
                    items: []
                });
            }
        });
};

StructureUI.prototype.removeBlock = function (event, hook) {
    event.stopPropagation();
    event.preventDefault();
    lackey.manager.remove(this._documentId, hook.getAttribute('data-lky-path').replace(/^layout\./, ''));
    this.emit('changed');
    this.drawSections();
};

StructureUI.prototype.editBlock = function (event, hook) {
    event.stopPropagation();
    event.preventDefault();

    let self = this,
        path = hook.getAttribute('data-lky-path'),
        shortPath = path.replace(/^layout\./, ''),
        block;

    lackey
        .manager
        .get(this._documentId, shortPath)
        .then((blk) => {
            block = blk;

            return readTemplate(block.template, 0);
        })
        .then(() => {

            self._stack.append('cms/cms/structure', {
                type: self._documentType,
                id: self._documentId,
                context: () => Promise.resolve(block),
                settings: (context) => Promise.resolve(context.props),
                settingsDictionary: (context) => {
                    if (typeof context.template === 'string') {
                        return StructureUI
                            .readTemplate(context.template)
                            .then((tmp) => tmp.props);
                    }
                    return context.template.props;
                },
                expose: (context) => {
                    return StructureUI
                        .readTemplate(context.template)
                        .then((tmp) => tmp.expose || []);
                },
                stack: self._stack
            }, (rootNode, vars, resolve) => {
                let listener = (evt) => {
                        if (evt.data.old === block) {
                            resolve();
                            self._stack.off('pop', listener);
                        }
                    },
                    structureController = new StructureUI(rootNode, vars);
                self._stack.on('pop', listener);
                structureController.bubble(this, 'changed');
                structureController.bubble(this, 'properties-changed', 'changed');
            });

        })
        .then(() => {});
};


StructureUI.prototype.drawSections = function () {
    let
        self = this,
        context;

    return this
        ._context()
        .then((ctx) => {
            context = ctx;
            return self._expose(ctx);
        })
        .then((expose) => {
            return template.redraw(lackey.hook('sections', self._node), {
                context: context,
                expose: expose
            });
        })
        .then(() => {
            lackey.bind('[data-lky-action="media-edit"]', 'click', lackey.as(self.editMedia, self), self._node);
            lackey.bind('[data-lky-action="block-add"]', 'click', lackey.as(self.addBlock, self), self._node);
            lackey.bind('[data-lky-action="block-remove"]', 'click', lackey.as(self.removeBlock, self), self._node);
            lackey.bind('[data-lky-action="block-inspect"]', 'click', lackey.as(self.editBlock, self), self._node);
        });

};


emit(StructureUI.prototype);
StructureUI.readTemplate = readTemplate;
module.exports = StructureUI;
