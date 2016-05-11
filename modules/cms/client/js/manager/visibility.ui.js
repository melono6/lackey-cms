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
    Autocomplete = require('cms/client/js/controls/autocomplete'),
    api = require('cms/client/js/api');


/**
 * @module lackey-cms/modules/cms/client/manager
 */

/**
 * @constructs lackey-cms/modules/cms/client/manager/VisibilityUI
 */
function VisibilityUI(rootNode, vars) {

    let self = this;
    this._toggle = lackey.hook('published', rootNode);
    this._toggle.checked = vars.state === 'published';
    this._toggle.addEventListener('change', () => {
        self.emit('publish-state-changed', self._toggle.checked ? 'published' : 'draft');
    }, true);

    this._autocomplete = new Autocomplete(lackey.hook('taxonomies', rootNode), {
        query: (text) => {
            return api
                .read('/cms/taxonomy?name=' + encodeURI(text + '%'))
                .then((data) => data.data);
        },
        value: vars.taxonomy || [],
        createNew: false,
        separators: [
            13,
            20
        ],
        formatLabel: (item) => {
            return item.type.label + ': ' + item.label;
        },
        equals: (item, term) => {
            return item.label === term;
        }
    });

    this._autocomplete.on('changed', lackey.as(this.updateTaxonomy, this));

}

emit(VisibilityUI.prototype);

VisibilityUI.prototype.updateTaxonomy = function (event) {
    this.emit('taxonomy-changed', event.data);
};

module.exports = VisibilityUI;
