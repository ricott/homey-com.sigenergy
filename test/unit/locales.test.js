'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const en = require('../../locales/en.json');
const sv = require('../../locales/sv.json');

function keyPaths(object, prefix = '') {
    return Object.entries(object).flatMap(([key, value]) => {
        const path = prefix ? `${prefix}.${key}` : key;
        return value !== null && typeof value === 'object' ? keyPaths(value, path) : [path];
    });
}

// A key missing from one locale shows users the raw i18n key instead of text.
test('every locale has the same translation keys', () => {
    assert.deepEqual(keyPaths(sv).sort(), keyPaths(en).sort());
});
