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
    bson = require('bson'),
    BSON = new bson.BSONPure.BSON(),
    SCli = require('../../utils/cli');

module.exports = function (server, config) {

    SCli.debug('lackey-cms/server/init/socket', 'Setting up');

    let clients = [];

    server.wsConnection = (request) => {
        let connection = request.accept('echo-protocol', request.origin);
        clients.push(connection);
        console.log((new Date()) + ' Connection accepted.');
        connection.on('message', function (message) {
            console.log(message);
            let data = BSON.deserialize(message.binaryData),
                buffer = new Buffer(data.data, 'binary');
            console.log(buffer);
            require('fs').writeFileSync('test.jpg', buffer);
            return;

            if (message.type === 'utf8') {
                console.log('Received Message: ' + message.utf8Data);
                connection.sendUTF(message.utf8Data);
            } else if (message.type === 'binary') {
                console.log('Received Binary Message of ' + message.binaryData.length + ' bytes');
                connection.sendBytes(message.binaryData);
            }
        });
        connection.on('close', function (reasonCode, description) {
            console.log((new Date()) + ' Peer ' + connection.remoteAddress + ' disconnected.');
            clients.splice(clients.indexOf(connection), 1);
        });

    };
};
