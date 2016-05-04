/* jslint node:true, esnext:true */
/* global LACKEY_PATH */
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

if (!GLOBAL.LACKEY_PATH) {
    /* istanbul ignore next */
    GLOBAL.LACKEY_PATH = process.env.LACKEY_PATH || __dirname + '/../../lib';
}

const mkdirp = require('mkdirp'),
    path = require('path'),
    SUtils = require(LACKEY_PATH).utils,
    fs = require('fs'),
      mime = require('mime');

let files = {};

function postProcess(file, config) {
    return new Promise((resolve, reject) => {
        resolve(mime.lookup(file.path));
    });
}

module.exports = (socket, config) => {


    socket.on('media.start-upload', (data) => {
        let now = new Date(),
            name = data.name,
            guid = data.guid,
            place,
            filePath = SUtils.getProjectPath() + 'uploads/' + config.get('site') + '/' + now.getFullYear() + '/' + now.getMonth() + '/' + guid + '/' + name,
            file = files[guid] = {
                fileSize: data.size,
                data: '',
                downloaded: 0,
                path: filePath
            };

        mkdirp(path.dirname(filePath), (err) => {
            if (err) {
                console.error(err);
                return;
            }

            try {
                let Stat = fs.statSync(filePath);
                if (Stat.isFile()) {
                    file.downloaded = Stat.size;
                    place = Stat.size / 524288;
                }
            } catch (ex) {}

            fs.open(filePath, 'a', 755, (err, fd) => {
                if (err) {
                    console.error(err);
                    return;
                }
                file.handler = fd;
                socket.emit('media.more-data', {
                    place: place,
                    percent: 0,
                    guid: guid
                });
            });
        });

    });

    function progress(file, guid) {
        file.data = '';
        let place = file.downloaded / 524288,
            percent = file.downloaded / file.fileSize * 100,
            done = file.downloaded === file.fileSize;

        if (done) {
            return postProcess(file, config)
                .then((response) => {
                    socket.emit('media.uploaded', {
                        place: place,
                        percent: percent,
                        downloaded: file.downloaded,
                        size: file.fileSize,
                        guid: guid,
                        media: response
                    });
                });
        }
        socket.emit('media.more-data', {
            place: place,
            percent: percent,
            downloaded: file.downloaded,
            size: file.fileSize,
            guid: guid
        });
    }

    socket.on('media.upload', (data) => {
        let guid = data.guid,
            file = files[guid];
        file.downloaded += data.data.length;
        file.data += data.data;
        if (file.downloaded === file.fileSize) {
            fs.write(file.handler, file.data, null, 'binary', (err) => {
                if (err) {
                    console.error(err);
                }
                delete files[guid];
                progress(file, guid);
            });
            return;
        }
        progress(file, guid);
    });
};
