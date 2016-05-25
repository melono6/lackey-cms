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

const INCLUDE_QUERY = `
                    id IN (
                        SELECT id FROM content WHERE
                            "templateId" IN (
                                SELECT "templateId" FROM "templateToTaxonomy" WHERE "taxonomyId" IN ($1)
                            )
                        UNION ALL
                        SELECT "contentId" FROM "contentToTaxonomy" WHERE "taxonomyId" IN ($1)
                   )`,
    EXCLUDE_QUERY = `
                    id NOT IN (
                        SELECT id FROM content WHERE "templateId" IN (
                            SELECT "templateId" FROM "templateToTaxonomy" where "taxonomyId" IN ($1)
                        )
                        UNION ALL
                        SELECT "contentId" FROM "contentToTaxonomy" WHERE "taxonomyId" IN ($1)
                    )`,
    EXCLUDE_IDS_QUERY = `
                        id NOT IN ($1)
                    `,
    REQUIRE_AUTHOR_QUERY = `
                        "userId" IN ($1)
                    `;

module.exports = require(LACKEY_PATH)
    .datasources.get('knex', 'default')
    .then((knex) => {

        class ContentQueryBuilder {

            constructor() {
                this._wheres = [];
            }

            withTaxonomies(taxonomies) {
                this.whereIn(INCLUDE_QUERY, taxonomies);
            }

            withoutTaxonomies(taxonomies) {
                this.whereIn(EXCLUDE_QUERY, taxonomies);
            }

            withoutIds(ids) {
                if (!ids) {
                    return;
                }
                this.whereIn(EXCLUDE_IDS_QUERY, (Array.isArray(ids) ? ids : [ids]));
            }

            withAuthor(ids) {
                if (!ids) {
                    return;
                }
                this.whereIn(REQUIRE_AUTHOR_QUERY, (Array.isArray(ids) ? ids : [ids]).map((object) => object.id ? object.id : object));
            }

            whereIn(template, values) {
                if (values && Array.isArray(values) && values.length) {
                    this._wheres.push(template.replace(/\$1/g, values.join(', ')));
                }
            }


            run(page, limit, order) {

                let query = 'SELECT route FROM content ';

                if (this._wheres.length) {
                    query += ' WHERE ' + this._wheres.join(' AND ');
                }

                query += ' ORDER BY "createdAt" DESC ';

                if (page > 0) {
                    query += ' OFFSET ' + page * limit + ' ';
                }

                query += ' LIMIT ' + limit;

                console.log('=====================');
                console.log(query);
                console.log('=====================');

                return knex
                    .raw(query)
                    .then((results) => {
                        return results.rows;
                    });
            }
        }
        return ContentQueryBuilder;
    });
