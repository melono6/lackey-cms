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
const url = require('url');

window.addEventListener('unload', () => {
    if (document.activeElement.href) {
        let location = url.parse(document.activeElement.href);
        top.document.location = '/admin' + location.path;
    }
}, true);

debugger;
let base = document.querySelector('head base'),
    loc = document.location,
    basePath = base ? base.getAttribute('href') : (loc.protocol + '//' + loc.host + (loc.port && loc.port.length ? (':' + loc.port) : '' ) + '/'),
    pathPrefix = basePath.replace(/.+?:\/\/.+?\/(.*)$/,'$1'),
    pathName = document.location.pathname.replace(/([^\/]{1})$/,'/'),
    pathNameWithNoPrefix = (pathPrefix && pathPrefix.length) ? pathName.replace(new RegExp('^' + pathPrefix)) : document.location.pathname,
    adminPath = basePath.replace(/\/$/,'') + '/admin' + pathNameWithNoPrefix;

if (top === window) {
    document.location.href = adminPath;
} else {
    let left = top.location.href.replace(/\/$/, ''),
        right = adminPath.replace(/\/$/, '');

    if(right === '/admin/cms/preview') {
        return;
    }

    if (left !== right) {
        top.location.href = adminPath + document.location.search;
    }
}
