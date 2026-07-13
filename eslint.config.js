'use strict';

const js = require('@eslint/js');
const globals = require('globals');

// Flat ESLint config for the app's Node (CommonJS) source. Browser widget
// assets under widgets/**/public are excluded — they run in the Homey web
// runtime with different globals and are not part of the Modbus/back-end code.
module.exports = [
    {
        ignores: [
            'node_modules/**',
            '.homeybuild/**',
            'widgets/**/public/**',
            'test/test.js' // legacy manual probe script, kept for hardware debugging
        ]
    },
    js.configs.recommended,
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2023,
            sourceType: 'commonjs',
            globals: {
                ...globals.node
            }
        },
        rules: {
            // Warn (don't fail) on issues that already exist in the codebase so
            // `npm run lint` stays green while surfacing things to tidy up.
            'no-unused-vars': ['warn', { argsIgnorePattern: '^_', caughtErrors: 'none' }],
            'no-empty': ['warn', { allowEmptyCatch: true }]
        }
    }
];
