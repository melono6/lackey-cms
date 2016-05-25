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
const gulp = require('gulp'),
    istanbul = require('gulp-istanbul'),
    mocha = require('gulp-mocha'),
    eslint = require('gulp-eslint'),
    sassLint = require('gulp-sass-lint'),
    del = require('del');

if (!GLOBAL.LACKEY_PATH) {
    /* istanbul ignore next */
    GLOBAL.LACKEY_PATH = process.env.LACKEY_PATH || __dirname + '/lib';
}

gulp.task('sass:lint', function () {
    gulp.src([
        '**/*.s+(a|c)ss',
        '!node_modules/**'
        ])
        .pipe(sassLint())
        .pipe(sassLint.format())
        .pipe(sassLint.failOnError());
});


gulp.task('lint', () => {
    return gulp.src([
        'lib/**/*.js',
        'modules/**/*.js',
        '!modules/*/server/routes/*.js',
        '!**/*.test.js'
    ])
        // pass your directives
        // as an object
        .pipe(eslint({
            extends: 'eslint:recommended',
            ecmaFeatures: {
                'modules': true
            },
            rules: {},
            globals: {},
            envs: [
            'node'
        ]
        }))
        // eslint.format() outputs the lint results to the console.
        // Alternatively use eslint.formatEach() (see Docs).
        .pipe(eslint.format());
});

gulp.task('pre-test:clean', () => {

    return del([
        'test/mockup/project/sites/default/htdocs',
        'test/mockup/project/uploads/default'
  ]);

});

gulp.task('pre-test', ['pre-test:clean'], function () {
    return gulp.src([
        'lib/**/*.js',
        'modules/*/**/*.js',
        '!modules/*/server/routes/*.js'
    ])
        .pipe(istanbul({
            includeUntested: true
        }))
        .pipe(istanbul.hookRequire());
});

gulp.task('test', ['pre-test'], function () {
    return gulp.src([
        'test/**/*.js',
        'modules/*/test/server/models/**/*.js',
        'modules/*/test/+(server|shared)/**/*.js',
        'modules/*/test/client/**/*.js'

    ])
        .pipe(mocha({
            bail: true,
            timeout: 50000
        }))
        .pipe(istanbul.writeReports({
            reporters: ['lcov', 'json', 'text', 'text-summary', 'html']
        }))
        .pipe(istanbul.enforceThresholds({
            thresholds: {
                global: 1
            }
        }))
        .once('end', function () {
            process.exit();
        });
});

gulp.task('mocha', ['pre-test:clean'], function () {
    return gulp.src([
        'test/**/*.js',
        'modules/*/test/server/models/**/*.js',
        'modules/*/test/+(server|shared)/**/*.js',
        'modules/*/test/client/**/*.js'
    ])
        .pipe(mocha({
            bail: true,
            timeout: 50000
        }));
});
