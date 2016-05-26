/* eslint no-underscore-dangle:0 */
/* jslint node:true, esnext:true */
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

const
    SUtils = require(LACKEY_PATH).utils,
    objection = require('objection'),
    Model = objection.Model,
    SCli = require(LACKEY_PATH).cli,
    __MODULE_NAME = 'lackey-cms/modules/core/server/models/session',
    KNEX = require('../knex');

SCli.debug(__MODULE_NAME, 'REQUIRED');

module.exports = SUtils
    .waitForAs(
        __MODULE_NAME,
        SUtils.cmsMod('core').model('objection'),
        KNEX
    )
    .then((ObjectionWrapper) => {

        SCli.debug(__MODULE_NAME, 'READY');

        class Session extends ObjectionWrapper {

            static get api() {
                return '/cms/session';
            }


            static get model() {
                return Session;
            }

            toJSON() {
                return {
                    name: this.name,
                    label: this.label
                };
            }

            get label() {
                return this._doc.label;
            }

            set label(value) {
                this._doc.label = value;
            }

            get acl() {
                return this._doc.acl;
            }

            set acl(value) {
                this._doc.acl = value;
            }

            static removeAll() {
                lighweights = {};
                return super.removeAll();
            }

            _populate() {
                return super
                    ._populate()
                    .then((self) => {
                        if (typeof self._doc.acl === 'string') {
                            self._doc.acl = JSON.parse(self._doc.acl);
                        }
                        return self;
                    });
            }

        }

        return Session
            .reload()
            .then(() => Session);
    });
