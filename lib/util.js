'use strict';

exports.pad = function (num, size) {
    var s = "000000000" + num;
    return s.substring(s.length - size);
}

exports.validateIPaddress = function (ipaddress) {
    if (/^(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.(25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$/.test(ipaddress)) {
        return (true)
    } else {
        return (false)
    }
}

exports.isError = function (err) {
    return (err && err.stack && err.message);
}

// Robustly format any thrown / rejected value into a readable string.
// Avoids the "[object Object]" trap when:
//   - err is a plain object without .message
//   - err.message exists but is empty / non-string
//   - err is null / undefined / a primitive
//   - err contains circular references
// jsmodbus rejections in particular are plain objects shaped like
// { err, message, request, response }, so we surface `err` + `message`.
exports.formatError = function (err) {
    if (err === null || err === undefined) {
        return 'Unknown error';
    }
    // Native Error (or anything Error-like with a usable message)
    if (err instanceof Error) {
        return err.message || err.toString() || 'Error';
    }
    // Strings / numbers / booleans
    if (typeof err !== 'object') {
        return String(err);
    }
    // jsmodbus UserRequestError shape: { err, message, request, response }
    if (typeof err.message === 'string' && err.message.length > 0) {
        if (typeof err.err === 'string' && err.err.length > 0) {
            return `${err.err}: ${err.message}`;
        }
        return err.message;
    }
    // Some libs use .err / .code / .errno / .reason
    if (typeof err.err === 'string' && err.err.length > 0) {
        return err.err;
    }
    if (typeof err.code === 'string') {
        return err.code;
    }
    if (typeof err.reason === 'string') {
        return err.reason;
    }
    // Last resort: try JSON.stringify, guarding against circular refs
    try {
        const json = JSON.stringify(err);
        if (json && json !== '{}') {
            return json;
        }
    } catch (_) {
        // fall through
    }
    return 'Unknown error';
}

// Buffer.write*BE truncates a non-integer value rather than rounding it, so
// float artefacts from `numValue * factor` (e.g. 1149.9999999999998) would be
// written one raw unit low. Round explicitly so the encoded value is the
// nearest representable one regardless of how the multiplication lands.
exports.createBuffer = function (numValue, factor) {
    let buffer = Buffer.alloc(2);
    buffer.writeInt16BE(Math.round(numValue * factor));
    return buffer;
}

/**
 * The discharge cut-off SOC (in %) that holds the battery at its current
 * level: one whole percent below the current SoC, so the battery cannot
 * discharge but is never asked to charge. A cut-off above the SoC would make
 * the plant charge from the grid at full power to reach it. Never goes below
 * the cut-off that applied before the hold, since the battery could not
 * discharge below that anyway. Returns undefined when the SoC is unknown.
 */
exports.holdCutoffSoc = function (soc, cutoffBeforeHold) {
    if (!Number.isFinite(soc)) {
        return undefined;
    }

    const floor = Number.isFinite(cutoffBeforeHold) ? cutoffBeforeHold : 0;
    const target = Math.floor(soc) - 1;

    return Math.min(100, Math.max(floor, target, 0));
}

exports.createBuffer32 = function (numValue, factor) {
    let buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(Math.round(numValue * factor));
    return buffer;
}

/**
 * Coerce a persisted value into a usable positive number.
 *
 * Accepts both a raw number (how these values are written to the device store)
 * and a unit-suffixed display string such as "13.2 kW" (how the same value is
 * written to device settings), because Number('13.2 kW') is NaN and would
 * otherwise discard the value entirely.
 *
 * Returns undefined rather than 0 for anything unusable, so callers can tell
 * "not known" apart from a genuine zero.
 *
 * @param {*} value - the raw stored value
 * @returns {number|undefined} the positive number, or undefined
 */
exports.parsePositiveNumber = function (value) {
    const number = typeof value === 'string' ? parseFloat(value) : Number(value);
    return Number.isFinite(number) && number > 0 ? number : undefined;
}

/**
 * Coerce a flow-card power input into a value safe to write to an unsigned
 * Modbus register.
 *
 * Anything non-numeric or negative collapses to 0, since createBuffer32 uses
 * writeUInt32BE and a negative value would throw rather than write. `max` is
 * only applied when it is a usable positive number, so an unknown rated power
 * (register unsupported or not yet read) leaves the value unbounded instead of
 * silently clamping it to zero.
 *
 * @param {*} value - the raw input value
 * @param {*} [max] - optional upper bound, ignored unless finite and > 0
 * @returns {number} the clamped value
 */
exports.clampPower = function (value, max) {
    let clamped = Number(value);
    if (!Number.isFinite(clamped) || clamped < 0) {
        clamped = 0;
    }

    const upperBound = Number(max);
    if (Number.isFinite(upperBound) && upperBound > 0 && clamped > upperBound) {
        clamped = upperBound;
    }

    return clamped;
}