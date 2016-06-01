/* jslint node:true */
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

module.exports = function (config) {

    let text = typeof config === 'string' ? config : config.message,
        status = config.status || 'info',
        div = document.createElement('div'),
        h;

    div.setAttribute('data-lky-growl', status);
    div.innerText = text;
    top.document.body.appendChild(div);
    div.style.top = h = (-div.clientHeight) + 'px';

    setTimeout(() => {
        div.style.top = '0px';
        setTimeout(() => {
            div.style.top = h;
            setTimeout(() => {
                top.document.body.removeChild(div);
            }, 500);
        }, 1500);
    }, 0);


};
