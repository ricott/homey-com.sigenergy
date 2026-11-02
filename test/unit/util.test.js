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

test('holdCutoffSoc holds 0.2 % below the current SoC', () => {
    assert.equal(util.holdCutoffSoc(65.7, 5), 65.5);
    assert.equal(util.holdCutoffSoc(64.3, 5), 64.1);
    assert.equal(util.holdCutoffSoc(80, 5), 79.8);
});

test('holdCutoffSoc never goes below the cut-off that applied before the hold', () => {
    // Near the bottom the original cut-off already stops discharge.
    assert.equal(util.holdCutoffSoc(5.1, 5), 5);
    assert.equal(util.holdCutoffSoc(3, 5), 5);
    // Without a known original, the floor is 0.
    assert.equal(util.holdCutoffSoc(0.1, undefined), 0);
    assert.equal(util.holdCutoffSoc(100, 5), 99.8);
});

test('holdCutoffSoc returns undefined when the SoC is unknown', () => {
    assert.equal(util.holdCutoffSoc(undefined, 5), undefined);
    assert.equal(util.holdCutoffSoc(NaN, 5), undefined);
});

test('followHoldCutoff raises the hold once the SoC has risen half a percent', () => {
    assert.equal(util.followHoldCutoff(64.5, 64.1, 5), undefined);
    assert.equal(util.followHoldCutoff(64.8, 64.1, 5), 64.6);
});

test('followHoldCutoff lowers the hold only when the SoC falls clearly below it', () => {
    // Settling at or just under the cut-off is normal: no write.
    assert.equal(util.followHoldCutoff(64.1, 64.1, 5), undefined);
    assert.equal(util.followHoldCutoff(63.7, 64.1, 5), undefined);
    assert.equal(util.followHoldCutoff(63.5, 64.1, 5), 63.3);
    // Never below the cut-off that applied before the hold.
    assert.equal(util.followHoldCutoff(4, 5, 5), undefined);
});

test('followHoldCutoff leaves the hold alone when the SoC is unknown', () => {
    assert.equal(util.followHoldCutoff(undefined, 64.1, 5), undefined);
    assert.equal(util.followHoldCutoff(64.1, undefined, 5), undefined);
});

test('clampPercent keeps a SOC setting within 0-100 % at 0.1 % resolution', () => {
    assert.equal(util.clampPercent(80), 80);
    assert.equal(util.clampPercent(80.04), 80);
    assert.equal(util.clampPercent(150), 100);
    assert.equal(util.clampPercent(-5), 0);
    assert.equal(util.clampPercent('abc'), 0);
});
