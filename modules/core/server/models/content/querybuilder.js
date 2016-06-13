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

const SCli = require(LACKEY_PATH).cli,
    INCLUDE_QUERY = `
        id IN (
            SELECT id FROM content AS con WHERE $1
       )`,
    INCLUDE_SUB = `
        (
            SELECT count(*) FROM (
                SELECT ttt."taxonomyId" FROM "content" AS c
                    JOIN "templateToTaxonomy" AS ttt
                        ON ttt."templateId" = c."templateId"
                        AND c.id = con.id
                UNION ALL
                SELECT ctt."taxonomyId" FROM "contentToTaxonomy" AS ctt
                    WHERE ctt."contentId" = con.id
                ) AS FOO
         WHERE "taxonomyId" IN ($1)) > 0
    `,
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
        `,
    RESTRICT_FOR_USER = `
        SELECT taxonomy.id FROM "taxonomyType"
            JOIN taxonomy ON "taxonomyTypeId" = "taxonomyType".id
            WHERE restrictive = true
            AND taxonomy.id NOT IN (
                /* TAXONOMIES */
                SELECT "taxonomyId" FROM "userToTaxonomy" WHERE "taxonomyUserId" = $1
                UNION ALL
                SELECT "taxonomyId" FROM "roleToTaxonomy" JOIN "acl" ON "roleToTaxonomy"."roleId" = "acl"."roleId" AND "acl"."userId" = $1
            )
        `,
    RESTRICT_FOR_ALL = `
        SELECT taxonomy.id FROM "taxonomyType"
            JOIN taxonomy ON "taxonomyTypeId" = "taxonomyType".id
            WHERE restrictive = true
        `,
      TEXT_SEARCH = `
        (
            layout::TEXT like '%$1%'
            OR
            name like '%$1%'
            OR
            route like '%$1%'
        )`;

module.exports = require(LACKEY_PATH)
    .datasources.get('knex', 'default')
    .then((knex) => {

        class ContentQueryBuilder {

            constructor() {
                this._wheres = [];
            }

            withTaxonomies(taxonomies) {
                if (taxonomies && Array.isArray(taxonomies) && taxonomies.length) {

                    let output = [];

                    taxonomies.forEach((group) => {
                        if(group && Array.isArray(group) && group.length) {
                         output.push(INCLUDE_SUB.replace(/\$1/g, group.join(', ')));
                        }
                    });

                    if(output.length) {
                        this._wheres.push(INCLUDE_QUERY.replace(/\$1/g, output.join(' AND ')));
                    } else {
                        this._wheres.push(INCLUDE_QUERY.replace(/\$1/g, 'TRUE'));
                    }
                }
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

            withId(id) {
                this._wheres.push('"id" = ' + id);
            }

            withTextSearch(text) {
                this._wheres.push(TEXT_SEARCH.replace('$1', text.replace(/[^a-zA-Z0-9\s+]/g,'')));
            }


            run(user, page, limit, order) {

                let self = this,
                    num_limit = limit || 10;

                return this
                    .getRestrictives(user ? (user.id ? user.id : user) : null)
                    .then((excludeRestrictives) => {

                        self.withoutTaxonomies(excludeRestrictives);

                        let countQuery = 'SELECT count(*) as "count" FROM content ',
                            query = 'SELECT route FROM content ';

                        if (self._wheres.length) {
                            query += ' WHERE ' + self._wheres.join(' AND ');
                            countQuery += ' WHERE ' + self._wheres.join(' AND ');
                        }

                        query += ' ORDER BY "createdAt" DESC ';

                        if (page > 0) {
                            query += ' OFFSET ' + page * num_limit + ' ';
                        }

                        query += ' LIMIT ' + num_limit;

                        return Promise.all([
                            SCli.sql(knex.raw(countQuery)).then((r) => r.rows),
                            SCli.sql(knex.raw(query)).then((r) => r.rows)
                        ]);

                    })
                    .then((results) => {

                        let count = +results[0][0].count;

                        return {
                            rows: results[1].map((r) => {
                                return r.route;
                            }),
                            paging: {
                                count: count,
                                page: +page,
                                limit: num_limit,
                                pages: Math.ceil(count / num_limit),
                                pageFormatted: 1 + (+page),
                            }
                        };
                    });
            }

            getRestrictives(userId) {

                let query = userId ? RESTRICT_FOR_USER.replace(/\$1/g, userId) : RESTRICT_FOR_ALL;

                return knex
                    .raw(query)
                    .then((results) => results.rows.map((row) => row.id));
            }
        }
        return ContentQueryBuilder;
    });
