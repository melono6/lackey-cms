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
const Emitter = require('cms/client/js/emitter').Emitter,
    lackey = require('core/client/js'),
    template = require('core/client/js/template'),
    modal = require('core/client/js/modal'),
    api = require('cms/client/js/api'),
    formatters = require('jsondiffpatch/src/formatters'),
    MediaModalController = require('cms/client/js/manager/media'),
    Autocomplete = require('cms/client/js/controls/autocomplete');

let cache = {};

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
        StructureUI
            .readTemplate(templatePath, index)
            .then((data) => {
                injectedChunk
                    .render(bodies.block, context.push(data))
                    .end();
            });
    });


};

/**
 * @class
 */
class StructureUI extends Emitter {

    static readTemplate(templatePath, index) {
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
    constructor(options, repository) {
            super();
            this.options = options;
            this._onRepositoryChanged = lackey.as(this.onRepositoryChanged, this);
            this.repository = repository;
            this.repository.on('changed', this._onRepositoryChanged);

        }
        /**
         * Builds UI
         * @returns {Promise<HTMLElement}
         */
    buildUI() {
        let self = this;
        return template
            .render('cms/cms/settings', this.options || {})
            .then((nodes) => {
                self.node = nodes[0];

                lackey
                    .select([
                        '[data-lky-hook="settings.open.meta"]',
                        '[data-lky-hook="settings.open.dimensions"]',
                        '[data-lky-hook="settings.open.taxonomy"]',
                        '[data-lky-hook="settings.open.blocks"]',
                        '[data-lky-hook="settings.open.diff"]'
                    ], self.node)
                    .forEach((element) => {
                        element.addEventListener('click', lackey.as(self.toggle, self), true);
                    });
                return self.drawMeta();
            })
            .then(() => {
                return self.drawTaxonomy();
            })
            .then(() => {
                return self.drawSections();
            })
            .then(() => {
                self.onRepositoryChanged();

                let diffToggle = lackey
                    .select('[data-lky-hook="settings.diff"] input', self.node)[0];

                if (document.body.className.toString().match(/jsondiffpatch-unchanged-hidden/)) {
                    diffToggle.setAttribute('checked', true);
                } else {
                    diffToggle.removeAttribute('checked');
                }
                diffToggle.addEventListener('change', (event) => {
                    if (diffToggle.checked) {
                        formatters.html.hideUnchanged();
                    } else {
                        formatters.html.showUnchanged();
                    }
                });
                return self.node;
            });
    }

    drawSections() {
        let context,
            self = this,
            expose;
        return this.options
            .context()
            .then((ctx) => {
                context = ctx;
                return self.options.expose(ctx);
            })
            .then((expose) => {
                return template.redraw('sections', {
                    context: context,
                    expose: expose
                }, self.node);
            })
            .then(() => {
                /*
                    lackey.bind('[data-lky-action="media-edit"]', 'click', lackey.as(self.editMedia, self), self._node);
                    lackey.bind('[data-lky-action="block-add"]', 'click', lackey.as(self.addBlock, self), self._node);
                    lackey.bind('[data-lky-action="block-remove"]', 'click', lackey.as(self.removeBlock, self), self._node);
                    lackey.bind('[data-lky-action="block-inspect"]', 'click', lackey.as(self.editBlock, self), self._node);*/
            });
    }

    onRepositoryChanged() {
        lackey
            .select('[data-lky-hook="settings.diff"] div', this.node)[0]
            .innerHTML = this.repository.visualDiff();
    }

    drawTaxonomy() {
        let self = this;
        return this.options
            .context()
            .then((context) => {

                let
                    tagsNode = lackey.hook('tags', this.node),
                    restrictionNode = lackey.hook('restricitons', this.node),
                    taxes = context.taxonomies || [],
                    tags = taxes.filter((tax) => !tax.type || !tax.type.restrictive),
                    restrictive = taxes.filter((tax) => tax.type && tax.type.restrictive),
                    options = {
                        createNew: false,
                        separators: [
                            13,
                            20
                        ],
                        formatLabel: (item) => {
                            return (item.type ? item.type.label + ': ' : '') + item.label;
                        },
                        equals: (item, term) => {
                            return item.label === term;
                        }

                    },
                    tagsControl = new Autocomplete(tagsNode, lackey.merge(options, {
                        query: (text) => {
                            return api
                                .read('/cms/taxonomy?restrictive=0&name=' + encodeURI(text + '%'))
                                .then((data) => data.data);
                        },
                        value: tags
                    })),
                    restrictiveControl = new Autocomplete(restrictionNode, lackey.merge(options, {
                        query: (text) => {
                            return api
                                .read('/cms/taxonomy?restrictive=1&name=' + encodeURI(text + '%'))
                                .then((data) => data.data);
                        },
                        value: restrictive
                    })),
                    handler = () => {

                        return self.options
                            .context()
                            .then((context) => {
                                context.taxonomies = [].concat(tagsControl.value, restrictiveControl.value);
                                self.emit('changed');
                            });
                    };
                tagsControl.on('changed', handler);
                restrictiveControl.on('changed', handler);
            });
    }

    drawMeta() {
        let self = this,
            settings,
            context,
            metaNode = lackey.select('[data-lky-template="cms/cms/properties"]', self.node)[0];

        return this.options
            .context()
            .then((ctx) => {
                context = ctx;
                return self.options.settings(ctx);
            })
            .then((stgs) => {
                settings = stgs;
                return self.options.settingsDictionary(context);
            })
            .then((dictionary) => {
                return template
                    .redraw(metaNode, self.mapDictionary({
                        values: settings,
                        dictionary: dictionary
                    }));
            })
            .then(() => {
                lackey.select(['input', 'select'], metaNode)
                    .forEach((input) => {
                        input.addEventListener('change', () => {
                            settings[input.name] = input.value;
                            self.emit('changed', settings);
                        }, true);
                    });
            });
    }

    toggle(event) {

        event.preventDefault();
        event.stopPropagation();

        let toOpen = event.target.getAttribute('data-lky-open'),
            current = this.node.getAttribute('data-lky-edit');

        if (current === toOpen) {
            this.node.removeAttribute('data-lky-edit');
        } else {
            this.node.setAttribute('data-lky-edit', toOpen);
        }
    }

    /**
     * Makes fade in animation
     * @returns {Promise}
     */
    fadeIn() {
        return new Promise((resolve) => {
            let self = this,
                handler = () => {
                    self.node.removeEventListener('transitionend', handler, false);
                    resolve();
                };
            setTimeout(() => {
                self.node.addEventListener('transitionend', handler, false);
                self.node.setAttribute('data-lky-open', '');
            }, 0);
        });
    }

    /**
     * Makes fade out animation
     * @returns {Promise}
     */
    remove() {
        this.repository.off('changed', this._onRepositoryChanged);
        this.repository = null;
        return new Promise((resolve) => {

            let self = this,
                handler = () => {
                    self.node.removeEventListener('transitionend', handler, false);
                    self.node.parentNode.removeChild(self.node);
                    resolve();
                };
            self.node.addEventListener('transitionend', handler, false);
            self.node.removeAttribute('data-lky-open');
        });
    }

    mapDictionary(data) {
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

}



module.exports = StructureUI;



/**
 * @module lackey-cms/modules/cms/client/manager

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
module.exports = StructureUI;*/
