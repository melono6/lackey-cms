/* jslint node:true, esnext:true */
/* globals LACKEY_PATH */
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

const SUtils = require(LACKEY_PATH).utils,
    SCli = require(LACKEY_PATH).cli,
    objection = require('objection'),
    Model = objection.Model,
    __MODULE_NAME = 'lackey-cms/modules/core/server/models/activity-log';

SCli.debug(__MODULE_NAME, 'REQUIRED');

module.exports = SUtils
    .waitForAs(__MODULE_NAME,
        SUtils.cmsMod('core').model('user'),
        SUtils.cmsMod('core').model('objection'),
        require('../knex')
    )
    .then((User, ObjectionWrapper) => {

        SCli.debug(__MODULE_NAME, 'READY');

        class ActivityLogModel extends Model {
            static get tableName() {
                return 'activityLog';
            }
        }

        class ActivityLog extends ObjectionWrapper {

            static get api() {
                return '/cms/activity';
            }

            static get model() {
                return ActivityLogModel;
            }

            get method() {
                return this._doc.method;
            }

            get url() {
                return this._doc.url;
            }

            get headers() {
                return this._doc.headers;
            }

            get body() {
                return this._doc.body;
            }

            get status() {
                return this._doc.status;
            }

            get response() {
                return this._doc.response;
            }

            get duration() {
                return this._doc.duration;
            }

            _populate() {
                if (typeof this._doc.body === 'string') {
                    this._doc.body = JSON.parse(this._doc.body);
                }
                if (typeof this._doc.response === 'string') {
                    this._doc.response = JSON.parse(this._doc.response);
                }
                if (typeof this._doc.headers === 'string') {
                    this._doc.headers = JSON.parse(this._doc.headers);
                }
                return Promise.resolve(this);
            }

            static log(data) {

                if (typeof data.body === 'string') {
                    data.body = {
                        raw: data.body
                    };
                }
                if (typeof data.headers === 'string') {
                    data.headers = {
                        raw: data.headers
                    };
                }
                if (typeof data.response === 'string') {
                    data.response = {
                        raw: data.response
                    };
                }

                return (new ActivityLog(data)).save();
            }
        }

        return ActivityLog;
    });
