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

const SUtils = require(LACKEY_PATH).utils,
    SCli = require(LACKEY_PATH).cli,
    objection = require('objection'),
    Model = objection.Model,
    __MODULE_NAME = 'lackey-cms/modules/core/server/models/content';

SCli.debug(__MODULE_NAME, 'REQUIRED');

module.exports = SUtils
    .waitForAs(__MODULE_NAME,
        SUtils.cmsMod('core').model('taggable'),
        SUtils.cmsMod('core').model('user'),
        require('../taxonomy'),
        require('../template'),
        require('../knex'),
        require(LACKEY_PATH).datasources.get('knex', 'default')
    )
    .then((Taggable, User, Taxonomy, Template, knexSchema, knex) => {

        SCli.debug(__MODULE_NAME, 'READY');

        class ContentModel extends Model {
            static get tableName() {
                return 'content';
            }

            static get jsonSchema() {
                return {
                    type: 'object',
                    required: ['type', 'route'],
                    properties: {
                        type: {
                            type: 'string',
                            default: 'page'
                        },
                        name: {
                            type: 'string'
                        },
                        layout: {
                            type: 'object'
                        },
                        props: {
                            type: 'object'
                        },
                        route: {
                            type: 'string'
                        },
                        state: {
                            type: 'string'
                        },
                        userId: {
                            type: 'integer'
                        },
                        templateId: {
                            type: 'integer'
                        },
                        createdAt: {
                            type: ['date', 'string']
                        }
                    }
                };
            }
        }

        class ContentToTaxonomy extends Model {
            static get tableName() {
                return 'contentToTaxonomy';
            }
        }

        /**
         * @class
         */
        class Content extends Taggable {

            static get model() {
                return ContentModel;
            }

            static get api() {
                return '/cms/content';
            }

            static get taxonomyRelationModel() {
                return ContentToTaxonomy;
            }

            static get taxonomyRelationField() {
                return 'contentId';
            }

            get type() {
                return this._doc.type;
            }

            get props() {
                return this._doc.props || {};
            }

            get author() {
                return this._user ? this._user.toJSON() : null;
            }

            set props(data) {
                this._doc.props = data;
            }

            diff(data) {
                if (data && typeof data.layout === 'object' && Object.keys(data.layout).length) {
                    this._doc.layout = data.layout;
                }
                return super.diff(data);
            }

            _populate() {
                let self = this;
                return super._populate()
                    .then(() => {
                        return User.findById(self._doc.userId);
                    })
                    .then((user) => {
                        self._user = user;
                        return Template.findById(this._doc.templateId);
                    })
                    .then((template) => {
                        self._template = template;
                        return SCli.sql(ContentToTaxonomy
                            .query()
                            .where('contentId', self.id));
                    })
                    .then((taxonomyIds) => {
                        return Taxonomy.findByIds(taxonomyIds.map((row) => row.taxonomyId));
                    })
                    .then((taxonomies) => {
                        self.taxonomies = taxonomies;
                        return self;
                    });
            }

            _preSave() {

                let self = this,
                    promise = super._preSave();

                if (this._doc.template) {
                    promise = promise
                        .then(() => {
                            return Template.generator(this._doc.template);
                        })
                        .then((template) => {
                            if (template) self._doc.templateId = template.id;
                        });
                }

                return promise.then(() => {

                    if (self._doc.templateId === undefined) {
                        delete self._doc.templateId;
                    }

                    if (self._doc.author) {
                        let author = this._doc.author;
                        if (typeof author === 'object') {
                            author = author ? author.id : null;
                        }
                        self._doc.userId = author;
                    }

                    delete self._doc.template;
                    delete self._doc.author;

                    if (self._doc.layout === undefined) {
                        delete self._doc.layout;
                    }

                    return self;
                });
            }

            _postSave(cached) {
                return super._postSave(cached);
            }

            toJSON() {
                return {
                    id: this.id,
                    $uri: this.uri,
                    type: this.type,
                    name: this.name,
                    route: this._doc.route,
                    createdAt: this._doc.createdAt,
                    props: this.props,
                    author: this._user ? this._user.toJSON() : null,
                    template: this._template ? this._template.toJSON() : null,
                    state: this._doc.state,
                    layout: this._doc.layout,
                    taxonomies: this.taxonomies
                };
            }

            toYAML() {
                let self = this;
                return Content.serializer
                    .serialize(self.toJSON())
                    .then((content) => {

                        let taxonomies = {};

                        if (content.taxonomies) {
                            content.taxonomies.forEach((taxonomy) => {
                                if (!taxonomies[taxonomy.type.name]) {
                                    taxonomies[taxonomy.type.name] = [];
                                }
                                taxonomies[taxonomy.type.name].push(taxonomy.name);
                            });
                        }

                        let promise = Promise.resolve();

                        if (self._user) {
                            promise = self._user.getIdentity('email')
                                .then((email) => {
                                    if (email) return email.accountId;
                                    return null;
                                });
                        }

                        return promise.then((author) => {

                            return {
                                type: content.type,
                                route: content.route,
                                props: content.props || {},
                                createdAt: content.createdAt || null,
                                template: content.template ? content.template.path : '',
                                taxonomies: taxonomies,
                                state: content.state,
                                author: author ? author : null,
                                layout: content.layout
                            };
                        }, (err) => {
                            console.error(err);
                            return err;
                        });
                    });

            }

            addTaxonomy(taxonomy) {
                let self = this;
                return SCli.sql(ContentToTaxonomy
                        .query()
                        .insert({
                            contentId: this.id,
                            taxonomyId: taxonomy.id
                        }))
                    .then(() => {
                        return self._populate();
                    });
            }

            removeTaxonomy(taxonomy) {
                let self = this;
                return SCli.sql(ContentToTaxonomy
                        .query()
                        .del()
                        .where('contentId', this.id)
                        .where('taxonomyId', taxonomy.id)
                    )
                    .then(() => {
                        return self._populate();
                    });
            }

            get route() {
                return this._doc.route;
            }


            get layout() {
                return this._doc.layout;
            }

            set layout(data) {
                this._doc.layout = data;
            }

            get uri() {
                if (!this._doc || !this._doc.id) return null;
                return '/api/cms/content/' + this._doc.id.toString();
            }

            get state() {
                return this._doc.state;
            }

            getTemplatePath() {

                SCli.debug('lackey-cms/modules/cms/server/models/page', 'Get template path', (this._template && this._template.path && this._template.path.length) ? 'exists' : 'doesn\'t exist');

                if (this._template && this._template.path && this._template.path.length) {
                    return this._template.path.toString();
                }
                return ['~/core/notemplate', 'cms/cms/notemplate', 'cms/cms/page'];
            }

            static getTypes() {
                return [
                'page',
                'block',
                'quote'
            ];
            }

            static getByTypeAndRoute(type, route) {
                return SCli.sql(ContentModel
                        .query()
                        .where('route', route)
                        .where('type', type))
                    .then((results) => {
                        if (results && results.length) {
                            return (new Content(results[0]))._populate();
                        }
                        return null;
                    });
            }

            static findByRoute(route) {
                return this.findOneBy('route', route);
            }

            static getByTaxonomies(taxonomyIds, excludeTaxonomyIds, author, limit, page, order, excludeId) {

                const INCLUDE_QUERY = `
                id IN (
                    SELECT id FROM content WHERE
                        "templateId" IN (
                            SELECT "templateId" FROM "templateToTaxonomy" WHERE "taxonomyId" IN ($1)
                        )
                    UNION ALL
                    SELECT "contentId" FROM "contentToTaxonomy" WHERE "taxonomyId" IN ($1)
               )`;
                const EXCLUDE_QUERY = `
                id NOT IN (
                    SELECT id FROM content WHERE "templateId" IN (
                        SELECT "templateId" FROM "templateToTaxonomy" where "taxonomyId" IN ($1)
                    )
                    UNION ALL
                    SELECT "contentId" FROM "contentToTaxonomy" WHERE "taxonomyId" IN ($1)
                )`;
                const EXCLUDE_IDS_QUERY = `
                id NOT IN ($1)
                `;
                const REQUIRE_AUTHOR_QUERY = `
                "userId" IN ($1)
            `;

                let wheres = [],
                    query = 'SELECT route FROM content ';

                if (taxonomyIds.length) {
                    wheres.push(INCLUDE_QUERY.replace(/\$1/g, taxonomyIds.join(', ')));
                }

                if (excludeTaxonomyIds.length) {
                    wheres.push(EXCLUDE_QUERY.replace(/\$1/g, excludeTaxonomyIds.join(', ')));
                }

                if (excludeId) {
                    wheres.push(EXCLUDE_IDS_QUERY.replace(/\$1/g, (Array.isArray(excludeId) ? excludeId.join(', ') : [excludeId])));
                }

                if (author) {
                    wheres.push(REQUIRE_AUTHOR_QUERY.replace(/\$1/g, (Array.isArray(author) ? author.join(', ') : [author.id ? author.id : author])));
                }

                if (wheres.length) {
                    query += ' WHERE ' + wheres.join(' AND ');
                }

                query += ' ORDER BY "createdAt" DESC ';

                if (page > 0) {
                    query += ' OFFSET ' + page * limit + ' ';
                }

                query += ' LIMIT ' + limit;

                return knex
                    .raw(query)
                    .then((results) => {
                        return results.rows.map((result) => result.route);
                    });
            }
        }
        Content.generator = require('./generator');
        Content.serializer = require('./serializer');
        return Content;
    });
