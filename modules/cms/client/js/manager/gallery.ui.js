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
    api = require('cms/client/js/api'),
    Upload = require('core/client/js/upload');;

/**
 * @class
 */
class Gallery extends Emitter {



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
    constructor(options) {
        super();
        this.options = options;
        this._locked = null;
        let self = this;
        this.promise = new Promise((resolve, reject) => {
            self.resolve = resolve;
            self.reject = reject;
        });
    }

    /**
     * Builds UI
     * @returns {Promise<HTMLElement}
     */
    buildUI() {
        let self = this;
        return template
            .render('cms/cms/gallery', this.options || {})
            .then((nodes) => {
                self.node = nodes[0];

                lackey.bind('[data-lky-hook="settings.back"]', 'click', () => {
                    self.resolve(null);
                }, self.node);

                if (!self.options.media || !self.options.media.id) {
                    self.node.setAttribute('data-lky-edit', 'gallery');
                    self.node.setAttribute('data-lky-has-media', 'false');
                } else {
                    self.node.removeAttribute('data-lky-has-media');
                    self.node.setAttribute('data-lky-edit', 'meta');
                }

                lackey
                    .select([
                        '[data-lky-hook="settings.open.meta"]',
                        '[data-lky-hook="settings.open.upload"]',
                        '[data-lky-hook="settings.open.url"]',
                        '[data-lky-hook="settings.open.gallery"]'
                    ], self.node)
                    .forEach((element) => {
                        element.addEventListener('click', lackey.as(self.toggle, self), true);
                    });

                lackey
                    .select('[data-lky-hook="settings.open.clear"]', self.node)
                    .forEach((element) => {
                        element.addEventListener('click', () => self.resolve(-1), true);
                    });

                self.zone = new Upload(lackey.hook('settings.open.upload', self.node), true);
                self.zone.on('done', (uploader, images) => {
                    if (images && images.length) {
                        self.resolve(images[0].data);
                    }
                });

                self.query();

                lackey.bind('input[type="search"]', 'keyup', lackey.as(self.keyup, self), self.node);

                return self.node;
            });
    }

    /**
     * KeyUp handler on search field
     */
    keyup() {
        let self = this;
        if (this._locked) {
            clearTimeout(this._locked);
        }
        this._locked = setTimeout(() => {
            self.query();
        }, 100);
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
            }, 50);
        });
    }

    /**
     * Makes fade out animation
     * @returns {Promise}
     */
    remove() {
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
     * Updates list of pages
     * @returns {Promise}
     */
    query() {
        let self = this,
            input = lackey.select('input[type="search"]', this.node)[0];
        api
            .read('/cms/media?q=' + encodeURI(input.value))
            .then((list) => {
                return template.redraw(lackey.select('[data-lky-hook="settings.gallery"] tbody', self.node)[0], list);
            })
            .then((nodes) => {
                lackey.bind('[data-lky-btn]', 'click', (event, hook) => {
                    self.resolve(JSON.parse(hook.getAttribute('data-lky-media')));
                }, nodes[0]);
            });
    }

}



module.exports = Gallery;
