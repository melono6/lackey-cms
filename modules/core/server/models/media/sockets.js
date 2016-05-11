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


const path = require('path'),
    SUtils = require(LACKEY_PATH).utils,
    mime = require('mime'),
    media = require('./index');

let files = {};

function postProcess(file, config) {
    let oldPath = file.path;
    return new Promise((resolve) => {
            resolve(mime.lookup(file.path));
        })
        .then((mimeType) => {
            file.mime = mimeType;
            let uploadSettings = config.get('upload');
            if (uploadSettings) {
                return SUtils
                    .s3PutObject(file.path, file.mime, uploadSettings)
                    .then((newLocation) => {
                        file.path = newLocation;
                        return SUtils.rimraf(path.dirname(oldPath));
                    });
            }
            return;
        })
        .then(() => {
            return media;
        })
        .then((Media) => {
            return (new Media({
                name: file.path,
                mime: file.mime,
                source: file.path,
                alternatives: []
            })).save();
        })
        .then((medium) => {
            return medium.toJSON();
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

        SUtils
            .mkdirp(path.dirname(filePath))
            .then(() => {
                return SUtils.stats(filePath);
            })
            .then((stat) => {
                if (stat.isFile()) {
                    file.downloaded = stat.size;
                    place = stat.size / 524288;
                }
                return SUtils.open(filePath, 'a', 777);
            })
            .then((handler) => {
                file.handler = handler;
                socket.emit('media.more-data', {
                    place: place,
                    percent: 0,
                    guid: guid
                });
            });
    });


    function progress(file, guid) {

        let place = file.downloaded / 524288,
            percent = file.downloaded / file.fileSize * 100,
            done = file.downloaded === file.fileSize;

        if (done) {
            return SUtils
                .close(file.handler)
                .then(() => {
                    file.handler = null;
                    return postProcess(file, config);
                })
                .then((response) => {
                    socket.emit('media.uploaded', {
                        guid: guid,
                        data: response,
                        place: place,
                        percent: percent,
                        downloaded: file.downloaded,
                        size: file.fileSize
                    });
                }, (err) => {
                    console.error(err);
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

            return SUtils
                .write(file.handler, file.data, 'binary', null)
                .then((err) => {
                    if (err) {
                        console.error(err);
                    }
                    delete files[guid];
                    progress(file, guid);
                });
        }
        progress(file, guid);
    });
};
