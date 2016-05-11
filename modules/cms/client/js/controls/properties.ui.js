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
    lackey = require('core/client/js');


/**
 * @module lackey-cms/modules/cms/client/controls
 */

/**
 * @constructs lackey-cms/modules/cms/client/controls/PropertiesUI
 */
function PropertiesUI(rootNode, vars) {
    let self = this;
    lackey.select(['input', 'select'], rootNode).forEach((input) => {
        input.addEventListener('change', function () {
            vars.values[input.name] = input.value;
            self.emit('changed', vars.values);
        }, true);
    });
}

PropertiesUI.map = function (data) {
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

emit(PropertiesUI.prototype);

module.exports = PropertiesUI;
