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

const SUtils = require(LACKEY_PATH).utils;

module.exports = SUtils
    .waitForAs('redirectCtrl',
        SUtils.cmsMod('core').model('redirect'),
        SUtils.cmsMod('core').controller('crud')
    )
    .then((Model, Crud) => {
        class RedirectCtrl extends Crud {

            static get model() {
                return Model;
            }

            static get field() {
                return 'redirectRule';
            }

            static get tableConfig() {
                return {
                    createdAt: {
                        label: 'Created at'
                    },
                    route: {
                        label: 'route',
                        like: true
                    },
                    target: {
                        label: 'target'
                    },
                    type: {
                        name: 'Type'
                    }
                };
            }

            static capture(req, res, next) {

                if (req.method !== 'GET') return next();

                //NOT DRY
                let route = (req.route || req.path).toString().replace(/\..*$/, '');

                route = route.replace(/\?.*$/, '');

                if (route === '') {
                    route = '/';
                }

                route = decodeURIComponent(route);

                // /NOT DRY

                Model
                    .getByRoute(route)
                    .then((rule) => {
                        if (rule) {
                            if (+rule.type === +Model.PERM || +rule.type === +Model.TEMP) {
                                res.status(rule.type);
                                res.redirect(rule.target);
                                return;
                            } else if (+rule.type === +Model.ALT) {
                                req.route = rule.target;
                            }
                        }
                        next();
                    });
            }

        }
        return Promise.resolve(RedirectCtrl);
    });
