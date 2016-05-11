/* eslint no-underscore-dangle:0, no-process-exit:0 */
/* jslint node:true, esnext:true */
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
const SUtils = require('../utils'),
    SCli = require('../utils/cli'),
    configFactory = require('../configuration'),
    datasources = require('../datasources'),
    express = require('./express'),
    errors = require('./init/errors'),
    moduleLoader = require('./module-loader'),
    BbPromise = require('bluebird'),
    sitemap = require('../sitemap');

class Server {

    constructor(config) {
        SCli.debug('lackey-cms/server', 'Server instance created');
        this._config = config;
        let htdocs = SUtils.getProjectPath() + '/htdocs';
        this._paths = {
            css: htdocs + '/css',
            lackeyCss: htdocs + '/css/cms',
            js: htdocs + '/js',
            lackeyJs: htdocs + '/js/cms'
        };
        this._modules = {};
        this._middlewares = [];
        this._postRouteWare = [];
        this._postwares = [];
        this._falcorRoutes = [];
        this._dustHelpers = [];
        this._started = false;

    }

    init() {
        SCli.log('lackey-cms/server', '1. Loading config');
        return BbPromise.resolve()
            .bind(this)
            .then(this._loadModules)
            .then(this._loadDataSources)
            .then(this._setupExpress)
            .then((server) => {
                this._express = server;
                return server;
            })
            .then(this._initModules)
            .then(this._listen)
            .then(this._capture);

    }

    addDustHelper(helper) {
        this._dustHelpers.push(helper);
    }

    addMiddleware(middleware) {
        if (this._started) {
            /* istanbul ignore next : it's too stupid to test */
            throw new Error('Express already started');
        }
        this._middlewares.push(middleware);
    }

    addPostRouteWare(postware) {
        if (this._started) {
            /* istanbul ignore next : it's too stupid to test */
            throw new Error('Express already started');
        }
        this._postRouteWare.push(postware);
    }

    addPostware(postware) {
        if (this._started) {
            /* istanbul ignore next : it's too stupid to test */
            throw new Error('Express already started');
        }
        this._postwares.push(postware);
    }

    getModule(name) {
        return this._modules[name];
    }

    setModule(name, value) {
        this._modules[name] = value;
        return this._modules[name];
    }

    getExpress() {
        return this._server;
    }


    getConfig() {
        return this._config;
    }

    _capture() {
        SCli.log('lackey-cms/server', '8. Capture');
        let _this = this;

        if (process.stdin.setRawMode) {
            process.stdin.setRawMode(false); // disable this all CLI nonsense
        }
        /* istanbul ignore next : interactive */
        process.on('SIGINT', () => {
            SCli.log('lackey-cms/server', 'Gracefull exit');
            _this._server.close(() => {
                // todo close databases
                process.exit();
            });
        });

        return this;

    }

    _listen() {
        SCli.log('lackey-cms/server', '7. Listen');
        this._falcorReady(this._falcorRoutes);

        let _this = this;

        this._postwares.forEach((postware) => {
            this._express.use(postware);
        });

        errors(this._express, this._config);

        return new BbPromise((resolve, reject) => {
            let port = this._config.get('http.port'),
                server;

            SCli.log('lackey-cms/server', 'Will listen to ' + port + ' node PORT env is equal ' + process.env.PORT);

            server = this._express.listen(port, (err) => {

                if (err) {
                    /* istanbul ignore next : it's too stupid to test */
                    return reject(err);
                }

                let host = server.address().address,
                    listeningPort = server.address().port;

                _this._server = server;

                sitemap.refresh();

                SCli.debug('lackey-cms/server', 'App listening to `' + host + '` at `' + listeningPort + '`');
                resolve(server);

            });
        });

    }

    _setupExpress() {
        SCli.log('lackey-cms/server', '5. Initing modules');
        return express(this._config, this._middlewares).then((result) => {
            this._express = result[0];
            this._falcorReady = result[1];
            return this._express;
        });
    }

    _initModules() {

        SCli.log('lackey-cms/server', '6. Initing modules');
        let _this = this,
            current = BbPromise.cast();

        moduleLoader.list().forEach((module) => {
            current = current.then(() => moduleLoader.loadModels(module));
        });
        moduleLoader.list().forEach((module) => {
            current = current.then(() => moduleLoader.loadRoutes(module, _this._express, _this._falcorRoutes));
        });
        if (_this._postRouteWare.length) {
            current = current.then(() => {
                return SUtils.serialPromise(_this._postRouteWare, (middleware) => {
                    return middleware(_this._express);
                });
            });
        }
        return current;
    }

    _loadModules() {
        SCli.log('lackey-cms/server', '2. Loading modules');
        return moduleLoader(this, this._config);
    }

    _loadDataSources() {
        SCli.log('lackey-cms/server', '4. Loading data sources');
        let promise = datasources.connect(this._config.get('datasources'));
        if (this._config.get('yml.drop') === true) {
            SCli.log('lackey-cms/server', '4. Droping database');
            promise = promise
                .then(() => {
                    return datasources.get('knex', 'default');
                })
                .then((knex) => {
                    return SCli.sql(knex.raw('drop schema public cascade;create schema public;'));
                }).then(() => {
                    SCli.log('lackey-cms/server', '4. Database dropped');
                });
        }
        return promise;
    }

    stop() {
        let self = this;
        return new BbPromise((resolve, reject) => {
            self._server.close((error) => {
                if (error) {
                    /* istanbul ignore next : it's too stupid to test */
                    return reject(error);
                }
                module.exports.instance = null;
                SCli.log('lackey-cms/server', 'Server fully closed');

                datasources.disconnect().then(() => {
                    resolve();
                });
            });
        });
    }

}

module.exports.instance = null;

module.exports = (event) => {

    SCli.asciiGreeting();
    SCli.log('lackey-cms/server', 'Starting site in `' + event.stage + '`');

    return configFactory(event.stage).then((config) => {
        let server = new Server(config);
        module.exports.instance = server;

        return server;
    });

};
