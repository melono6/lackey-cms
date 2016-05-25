/* jslint esnext:true, node:true */
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

const SUtils = require(LACKEY_PATH).utils;

module.exports = SUtils
    .waitForAs('mediaCtrl',
        SUtils.cmsMod('core').model('media'),
        SUtils.cmsMod('core').controller('crud')
    )
    .then((Model, Crud) => {
        class Controller extends Crud {

            static get model() {
                return Model;
            }

            static get field() {
                return 'media';
            }

            static get tableConfig() {
                return null;
            }

            static create(req, res) {
                if (req.body.source) {
                    return Model
                        .create(req.body)
                        .then((model) => {
                            res.api(model);
                        }, (error) => {
                            res.error(req, error);
                        });
                } else {
                    res.error(new Error('You are nasty'));
                }
            }
        }

        return Promise.resolve(Controller);
    });
