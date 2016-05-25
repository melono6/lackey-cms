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
/**
 * Module dependencies.
 */
const passport = require('passport'),
    LocalStrategy = require('passport-local').Strategy,
    SUtils = require(LACKEY_PATH).utils;

module.exports = function () {
    // Use local strategy
    passport.use(new LocalStrategy({
        usernameField: 'username',
        passwordField: 'password'
    }, module.exports.handler(SUtils.cmsMod('core').model('user'))));
};

/**
 * Handle request
 * @param   {Promise<User>} promise
 * @returns {Promise}
 */
module.exports.handler = function (promise) {
    return function (username, password, done) {
        return promise
            .then((UserClass) => {
                return UserClass.getByProvider([UserClass.USERNAME, UserClass.EMAIL], username);
            })
            .then((user) => {
                if (!user) {
                    return done(null, false, {
                        message: 'User doesn\'t exist'
                    });
                }
                if (!user.authenticate(password)) {
                    return done(null, false, {
                        message: 'Invalid username or password'
                    });
                }

                return done(null, user);
            })
            .catch((error) => {
                done(error);
            });

    };
};
