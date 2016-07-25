/* jslint esnext:true, node:true */
/* globals LACKEY_PATH */
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

const SUtils = require(LACKEY_PATH).utils,
    objection = require('objection'),
    mimeLib = require('mime'),
    fileType = require('file-type'),
    http = require('http'),
    https = require('https'),
    _ = require('lodash'),
    SCli = require(LACKEY_PATH).cli,
    Model = objection.Model,
    OCTET = 'application/octet-stream',
    __MODULE_NAME = 'lackey-cms/modules/core/server/models/media';

SCli.debug(__MODULE_NAME, 'REQUIRED');

module.exports = SUtils
    .waitForAs(__MODULE_NAME,
        SUtils.cmsMod('core').model('objection'),
        require('../knex')
    )
    .then((ObjectionWrapper) => {

        SCli.debug(__MODULE_NAME, 'READY');

        class MediaModel extends Model {
            static get tableName() {
                return 'media';
            }

            static get jsonSchema() {
                return {
                    type: 'object',
                    properties: {
                        name: {
                            type: 'string'
                        },
                        mime: {
                            type: 'string'
                        },
                        source: {
                            type: 'string'
                        },
                        alternatives: {
                            type: ['object', 'array']
                        },
                        attributes: {
                            type: 'object'
                        },
                        userId: {
                            type: 'integer'
                        }
                    }
                };
            }
        }

        let __debug = (typeof global.it === 'function') ? 'image/jpeg' : false;

        class Media extends ObjectionWrapper {

            static get api() {
                return '/cms/media';
            }

            static get likeables() {
                return {
                    name: 'lr',
                    source: 'lr'
                };
            }

            static get model() {
                return MediaModel;
            }

            static set debug(value) {
                __debug = value;
            }

            static get debug() {
                return __debug;
            }

            static lookupMime(path, forceMime) {

                if (forceMime) {
                    return Promise.resolve(forceMime);
                }

                if(path.match(/^https:\/\/unsplash\.it/)) {
                    return Promise.resolve('image/jpeg');
                }

                if(path.match(/^https:\/\/www.youtube.com\//)) {
                    return Promise.resolve('video/youtube');
                }

                SCli.debug('lackey-cms/modules/media/server/models/media', 'lookupMime', path);
                let mime = mimeLib.lookup(path),
                    isWeb = path.match(/^(http|https|)\:\/\/.+$/) !== null;

                mime = mime === OCTET ? null : mime;

                if (!mime) {
                    if (!isWeb) {
                        return Promise.resolve(OCTET);
                    } else {
                        return new Promise((resolve, reject) => {
                            if (__debug) {
                                return resolve(__debug);
                            }
                            (path.match(/^https/) ? https : http).get(path, (res) => {
                                try {
                                    res.once('data', chunk => {
                                        try {
                                            res.destroy();
                                            let m = fileType(chunk);
                                            resolve(m ? m.mime : 'image/jpeg');
                                        } catch (e) {
                                            reject(e);
                                        }
                                    });
                                } catch (e) {
                                    reject(e);
                                }
                            });
                        });
                    }
                }
                return Promise.resolve(mime);
            }

            static mimeToType(mime) {
                SCli.debug('lackey-cms/modules/media/server/models/media', 'mimeToType', mime);
                return mime.split('/')[0];
            }

            static mapSource(source) {
                SCli.debug('lackey-cms/modules/media/server/models/media', 'mapSource', source);
                if (typeof source === 'string') {
                    return Media.lookupMime(source)
                        .then((mime) => {
                            return {
                                type: Media.mimeToType(mime),
                                mime: mime,
                                source: source,
                                alternatives: []
                            };
                        });
                }
                if (source.source) {
                    return Media.mapSource(source.source);
                }
                if (Array.isArray(source)) {
                    return Promise.all(source.map((entry) => {
                            if (typeof entry === 'string') {
                                return Media.lookupMime(entry)
                                    .then((mime) => {
                                        return {
                                            mime: mime,
                                            source: entry
                                        };
                                    });
                            }
                            return Media
                                .lookupMime(entry.src)
                                .then((mime) => {
                                    return {
                                        mime: mime,
                                        source: entry.src,
                                        dimension: entry.dimension
                                    };
                                });
                        }))
                        .then((list) => {
                            let main,
                                output,
                                srcset = [];

                            list.forEach((elem) => {
                                if (typeof elem === 'string' && !main) {
                                    main = elem;
                                    srcset.push(elem);
                                    return;
                                }
                                if (!main) {
                                    main = elem;
                                }
                                srcset.push(elem.source + (elem.dimension ? ' ' + elem.dimension : ''));
                            });
                            output = {
                                type: Media.mimeToType(main.mime),
                                mime: main.mime,
                                source: main.source
                            };
                            if (srcset.length) {
                                output.srcset = srcset.join(',');
                            }

                            return output;
                        });
                } else {
                    return Promise.all(Object
                        .keys(source)
                        .map((key) => {

                            if (Array.isArray(source[key])) {
                                return Promise.all(source[key].map((item) => {
                                    return Media._wrapInLoop(key, item.src, item.media);
                                }));
                            }

                            return Media._wrapInLoop(key, source[key]);

                        })).then((list) => {

                        let main,
                            _list = [];

                        list.forEach((item) => {
                            if (!Array.isArray(item)) {
                                return _list.push(item);
                            }
                            _list = _list.concat(item);

                        });

                        main = _list[0];

                        return {
                            alternatives: _list,
                            type: Media.mimeToType(main.type),
                            mime: main.type,
                            source: main.src
                        };

                    });
                }

            }

            static _wrapInLoop(mime, src, media) {
                SCli.debug('lackey-cms/modules/media/server/models/media', 'wrapInLoop', mime, src, media);
                let promise;
                if (!mime || mime.indexOf('/') === -1) {
                    promise = Media.lookupMime(src)
                        .then((_mime) => {
                            return {
                                type: _mime,
                                src: src,
                                media: media
                            };
                        });
                } else {
                    promise = Promise.resolve({
                        type: mime,
                        src: src,
                        media: media
                    });
                }
                return promise.then((item) => {
                    if (!item.media) {
                        delete item.media;
                    }
                    return item;
                });
            }

            _preSave() {
                SCli.debug('lackey-cms/modules/media/server/models/media', 'preSave');
                let self = this,
                    isString = (typeof this._doc.source !== 'string'),
                    promise = Promise.resolve();

                if (isString) {
                    promise = Media.mapSource(this._doc.source)
                        .then((mixin) => {
                            _.merge(self._doc, mixin);
                        });
                }

                return promise
                    .then(() => {
                        if (!self._doc.mime) {
                            return Media.lookupMime(self._doc.source)
                                .then((mime) => {
                                    self._doc.mime = mime;
                                });
                        }
                    })
                    .then(() => self);
            }

            get source() {
                return this._doc.source;
            }

            get type() {
                return Media.mimeToType(this._doc.mime);
            }

            get mime() {
                return this._doc.mime;
            }

            get alternatives() {
                return this._doc.alternatives;
            }

            toJSON() {
                return {
                    id: this.id,
                    $uri: this.uri,
                    name: this.name,
                    source: this.source,
                    alternatives: this.alternatives,
                    mime: this.mime,
                    type: this.type,
                    createdAt: this._doc.createdAt,
                    author: this._doc._userId,
                    attributes: this._doc.attributes
                };
            }

            get uri() {
                return '/api/media/' + this._doc.id.toString();
            }

            static findByPathAndType(path, mime) {
                SCli.debug('lackey-cms/modules/media/server/models/media', 'findByPathAndType ' + path);
                return SCli.sql(MediaModel
                    .query()
                    .where('source', path)
                    .where('mime', mime)
                ).then((result) => {
                    if (!result || !result.length) {
                        return null;
                    }
                    return new Media(result[0]);
                });
            }

        }

        Media.generator = require('./generator');
        return Media;
    });
