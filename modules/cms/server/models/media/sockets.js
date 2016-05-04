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
    mime = require('mime'),
    // brew install ffmpeg --with-libvpx  --with-theora --with-libogg --with-vorbis --with-libvorbis
    ffmpeg = require('fluent-ffmpeg');

let files = {};


function ffmpegConvert(source, destination) {
    console.log('convert', source, destination);
    let i = (new Date().getTime());
    return new Promise((resolve, reject) => {
        ffmpeg(source, {
                logger: console
            })
            .on('end', () => {
                console.log('took ' + ((new Date()).getTime() - i) + ' seconds');
                resolve();
            })
            .on('error', (error) => reject(error))
            .output(destination)
            .run();
    });
}

function ffmpegConvertWEBM(source, destination) {
    console.log('convert', source, destination);
    let i = (new Date().getTime());
    return new Promise((resolve, reject) => {
        ffmpeg(source, {
                logger: console
            })
            .outputOptions([
                '-b', '3900k',
                '-acodec', 'libvorbis',
                '-ab', '100k',
                '-vpre', 'libvpx-720p',
                '-f', 'webm'
            ])
            .on('end', () => {
                console.log('took ' + ((new Date()).getTime() - i) + ' seconds');
                resolve();
            })
            .on('error', (error) => reject(error))
            .output(destination)
            .run();
    });
}

function thumbnail(source, destination) {
    console.log('thumbnail', source, destination);
    return new Promise((resolve, reject) => {
        ffmpeg(source, {
                logger: console
            })
            .on('end', () => resolve())
            .on('error', (error) => reject(error))
            .screenshots({
                count: 1,
                folder: destination,
                fileName: 'thumbnail.png'
            });
    });
}

function convertVideo(filePath) {
    let dirName = path.dirname(filePath),
        baseName = path.basename(filePath);

    return ffmpegConvert(filePath, dirName + '/' + baseName + '.converted.mp4')
        .then(() => {
            return ffmpegConvert(filePath, dirName + '/' + baseName + '.converted.ogg');
        }).then(() => {
            return thumbnail(filePath, dirName);
        }).then(() => {
            return ffmpegConvertWEBM(filePath, dirName + '/' + baseName + '.converted.webm');
        }).then(() => {
            console.log('done');
            return [{
                file: dirName + '/' + baseName + '.converted.mp4',
                mime: 'video/mp4'
            }, {
                file: dirName + '/' + baseName + '.converted.webm',
                mime: 'video/webm'
            }, {
                file: dirName + '/' + baseName + '.converted.ogg',
                mime: 'video/ogg'
            }, {
                file: dirName + '/thumbnail.png',
                mime: 'image/png'
            }];
        });

}

function postProcess(file) {
    let fileMime = mime.lookup(file.path),
        majorType = fileMime.split('/')[0];
    if (majorType === 'video') {
        return convertVideo(file.path, fileMime);
    }
    return Promise.resolve([{
        file: file.path,
        mime: fileMime
    }]);
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

            fs.open(filePath, 'a', 775, (err, fd) => {
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
                }, (error) => {
                    console.log(error);
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
