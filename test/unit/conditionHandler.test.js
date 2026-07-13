'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');

const conditionHandler = require('../../lib/conditionHandler.js');

test('evaluateNumericCondition compares above/below/equals', () => {
    assert.equal(conditionHandler.evaluateNumericCondition('number.above', 5, 10), true);
    assert.equal(conditionHandler.evaluateNumericCondition('number.above', 5, 1), false);
    assert.equal(conditionHandler.evaluateNumericCondition('number.below', 5, 1), true);
    assert.equal(conditionHandler.evaluateNumericCondition('number.below', 5, 10), false);
    assert.equal(conditionHandler.evaluateNumericCondition('number.equals', 5, 5), true);
    assert.equal(conditionHandler.evaluateNumericCondition('number.equals', 5, 6), false);
});

test('evaluateNumericCondition returns false for NaN threshold or null value', () => {
    assert.equal(conditionHandler.evaluateNumericCondition('number.above', NaN, 10), false);
    assert.equal(conditionHandler.evaluateNumericCondition('number.above', 5, null), false);
    assert.equal(conditionHandler.evaluateNumericCondition('number.above', 5, undefined), false);
});

test('getNumberConditions / getStringConditions filter by prefix', () => {
    const numbers = conditionHandler.getNumberConditions();
    assert.ok(numbers.length > 0);
    assert.ok(numbers.every(c => c.id.startsWith('number')));

    const strings = conditionHandler.getStringConditions();
    assert.ok(strings.length > 0);
    assert.ok(strings.every(c => c.id.startsWith('string')));
});
