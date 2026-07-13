'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const util = require('../../lib/util.js');

test('pad left-pads a number to the requested width', () => {
    assert.equal(util.pad(5, 3), '005');
    assert.equal(util.pad(123, 3), '123');
    assert.equal(util.pad(12345, 3), '345'); // keeps the last `size` chars
});

test('validateIPaddress accepts valid IPv4 and rejects invalid input', () => {
    assert.equal(util.validateIPaddress('192.168.0.1'), true);
    assert.equal(util.validateIPaddress('0.0.0.0'), true);
    assert.equal(util.validateIPaddress('255.255.255.255'), true);
    assert.equal(util.validateIPaddress('256.1.1.1'), false);
    assert.equal(util.validateIPaddress('192.168.0'), false);
    assert.equal(util.validateIPaddress('not-an-ip'), false);
});

test('isError distinguishes Error-like objects', () => {
    assert.ok(util.isError(new Error('boom')));
    assert.ok(!util.isError({ message: 'no stack' }));
    assert.ok(!util.isError('string'));
});

test('createBuffer / createBuffer32 encode big-endian with the gain factor', () => {
    assert.deepEqual([...util.createBuffer(5, 1)], [0x00, 0x05]);
    assert.deepEqual([...util.createBuffer32(10, 1000)], [0x00, 0x00, 0x27, 0x10]); // 10000
});

test('formatError handles Errors', () => {
    assert.equal(util.formatError(new Error('kaboom')), 'kaboom');
});

test('formatError surfaces jsmodbus-style { err, message } objects', () => {
    assert.equal(util.formatError({ err: 'OutOfSync', message: 'fc mismatch' }), 'OutOfSync: fc mismatch');
    assert.equal(util.formatError({ message: 'only message' }), 'only message');
});

test('formatError falls back through err / code / reason', () => {
    assert.equal(util.formatError({ err: 'SomeErr' }), 'SomeErr');
    assert.equal(util.formatError({ code: 'ECONNRESET' }), 'ECONNRESET');
    assert.equal(util.formatError({ reason: 'because' }), 'because');
});

test('formatError never yields "[object Object]" for primitives / nullish', () => {
    assert.equal(util.formatError(null), 'Unknown error');
    assert.equal(util.formatError(undefined), 'Unknown error');
    assert.equal(util.formatError('a string'), 'a string');
    assert.equal(util.formatError(42), '42');
    assert.equal(util.formatError({}), 'Unknown error');
});
