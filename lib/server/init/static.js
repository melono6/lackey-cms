/*jslint node:true, nomen:true, esnext:true */
'use strict';

/*
    Copyright 2015 Enigma Marketing Services Limited

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


let path = require('path'),
    express = require('express'),
    SUtils = require('../../utils'),
    SCli = require('../../utils/cli');

module.exports = function (server) {

    SCli.debug('lackey-cms/server/init/static', 'Setting up');

    var docroot = path.join(SUtils.getProjectPath() + '/htdocs');

    server.use(express.static(docroot, {
        redirect: false
    }));
    server.use('/uploads', express.static(SUtils.getProjectPath() + 'uploads', {
        redirect: false
    }));
};
