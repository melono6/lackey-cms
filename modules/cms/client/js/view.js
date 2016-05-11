/* eslint no-cond-assign:0 */
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
    wysiwyg = require('cms/client/js/wysiwyg'),
    lackey = require('core/client/js');

wysiwyg.init();

lackey.hooks('structure-add-block').forEach((hook) => {

    hook.innerText = 'Add Block';
    hook.style.width = '100%';
    hook.style.cursor = 'pointer';
    hook.style.textAlign = 'center';
    lackey.bind(hook, 'click', () => {
        top.Lackey.manager.addBlock(hook.getAttribute('data-lky-content'), hook.getAttribute('data-lky-path'));
    });
});
