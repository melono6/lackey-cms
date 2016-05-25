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

const bestmatch = require('bestmatch'),
    SEP = ':';


function parse(value, variant, state, locale) {

    if (!value || value.type !== 'Variants') {
        return value;
    }

    let
        filter = module.exports.pattern(variant, state, locale),
        map = {},
        variants = Object.keys(value).map(function (rule) {
            let ruleParts = rule.split(SEP),
                result;
            result = module.exports.pattern(ruleParts[0], ruleParts[1], ruleParts[2]);
            map[result] = rule;
            return result;
        }).filter((val) => {
            return val !== 'type';
        }),
        key = map[bestmatch(variants, filter)];

    return value[key];
}

module.exports.walk = function walk(schema) {
    if (typeof schema !== 'object') return schema;
    if (schema.type === 'paragraph' && schema.content) {
        let hasYOUTUBE = false;
        schema.content.forEach((node) => {
            if (node.marks && node.text === 'IFRAME') {
                node.marks.forEach((mark) => {
                    if (mark._ === 'link') {
                        hasYOUTUBE = mark.href;
                    }
                });
            }
        });
        if (hasYOUTUBE) {
            schema.type = 'iframe';
            delete schema.content;
            schema.attrs = {
                src: hasYOUTUBE
            };
        }
    }
    if (schema.content) {
        schema.content.forEach((node) => {
            module.exports.walk(node);
        });
    }
    return schema;
};

module.exports.pattern = (variant, state, locale) => {
    if (!variant && !state && !locale) {
        return '*';
    }

    let output = variant || '*';
    if (state || locale) {
        output += SEP + (state || '*');
        if (locale) {
            output += SEP + (locale || '*');
        }
    } else {
        output += SEP + '*';
    }

    if (output === '*:*:*' || output === '*:*') {
        return '*';
    }

    return output;
};

function crawl(object, path, value, setOperation) {

    let elems = path ? path.split('.') : [],
        field = elems.shift();

    if (setOperation && object && (field !== undefined && field !== null)) {
        if (elems.length > 0) {
            object[field] = object[field] || {};
        } else {
            object[field] = value;
        }
    }

    if (!path || !path.length || !object) {
        return object;
    }

    return crawl(object[field], elems.join('.'), value, setOperation);
}

module.exports.set = (root, path, value, variant, state, locale) => {
    if (!path) {
        throw new Error('Path is requried in setter');
    }
    let input = {},
        old = crawl(root, path),
        target = module.exports.pattern(variant, state, locale),
        notVariant = !old || (typeof old === 'string') || !old.type || (old.type && old.type !== 'Variants');

    if (notVariant && target === '*') {
        input = value;
    } else {
        if (notVariant && old) {
            if (typeof old === 'object' && old.hasOwnProperty('*')) {
                input = old;
            } else if (typeof old !== 'object' || old.type) {
                input['*'] = old;
            }
            input.type = 'Variants';
        } else {
            input = old || {
                type: 'Variants'
            };

        }
        input[target] = value;

    }
    crawl(root, path, input, true);

};

module.exports.insertAfter = (root, path, value) => {
    if (!path) {
        throw new Error('Path is requried in setter');
    }
    let parts = path.split('.'),
        parentPath = parts.slice(0, -1).join('.'),
        parent = crawl(root, parentPath),
        index = (+parts[parts.length - 1]) + 1;

    if (parent && Array.isArray(parent)) {
        parent.splice(index, 0, value);
    } else if (!parent) {
        this.set(root, parentPath, [value]);
    } else {
        parent = [parent];
        parent.splice(index, 0, value);
        this.set(root, parentPath, parent);
    }
};

module.exports.remove = (root, path) => {
    if (!path) {
        throw new Error('Path is requried in setter');
    }
    let parts = path.split('.'),
        parentPath = parts.slice(0, -1).join('.'),
        parent = crawl(root, parentPath),
        index = (+parts[parts.length - 1]);

    if (parent && Array.isArray(parent)) {
        parent.splice(index, 1);
    }
};

module.exports.crawl = crawl;


module.exports.get = (root, path, variant, state, locale) => {
    return parse(crawl(root, path), variant, state, locale);
};
