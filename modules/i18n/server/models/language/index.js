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
    SCli = require(LACKEY_PATH).cli,
    objection = require('objection'),
    Model = objection.Model,
    __MODULE_NAME = 'lackey-cms/modules/language/server/models/language';

module.exports = SUtils
    .waitForAs(__MODULE_NAME,
        SUtils.cmsMod('core').model('objection'),
        require('./knex')
    )
    .then((ObjectionWrapper) => {

        class LanguageModel extends Model {
            static get tableName() {
                return 'language';
            }
        }

        /**
         * @class
         */
        class Language extends ObjectionWrapper {

            static get api() {
                return '/cms/language';
            }

            static get model() {
                return LanguageModel;
            }

            get code() {
                return this._doc.code;
            }

            get nativeName() {
                return this._doc.nativeName;
            }

            get enabled() {
                return this._doc.enabled;
            }

            static get default() {
                return SCli.sql(LanguageModel
                    .query()
                    .where('default', true)
                ).then((list) => {
                    if (list.length) {
                        return list[0].code;
                    }
                    return null;
                });
            }

            toJSON() {
                return {
                    id: this.id,
                    code: this.code,
                    name: this.name,
                    nativeName: this.nativeName,
                    enabled: this.enabled,
                    default: this._doc.default
                };
            }

            static getByCode(code) {

                return SCli.sql(LanguageModel
                    .query()
                    .where('code', code)
                ).then((list) => {
                    if (list[0]) {
                        return new Language(list[0]);
                    }
                    return null;
                });
            }

            static getEnabled() {
                return SCli.sql(LanguageModel
                    .query()
                    .where('enabled', true)
                ).then((list) => {
                    return list.map((language) => {
                        return new Language(language);
                    });
                });
            }

        }

        let generator = require('./generator'),
            initData = require('./init-data.json');

        return SUtils.serialPromise(Object.keys(initData), (code) => {
            let data = initData[code];
            data.code = code;
            return generator(data, Promise.resolve(Language));
        }).then(() => {
            return Language;
        });

    });
