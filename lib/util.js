'use strict';
const net = require('net');

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

exports.isPortAvailable = function (address, port) {
    return new Promise((resolve => {
        const socket = new net.Socket();

        const onError = () => {
            socket.destroy();
            resolve(false);
        };

        socket.setTimeout(1000);
        socket.once('error', onError);
        socket.once('timeout', onError);

        socket.connect(port, address, () => {
            socket.end();
            resolve(true);
        });
    }));
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

exports.createBuffer = function (numValue, factor) {
    let buffer = Buffer.alloc(2);
    buffer.writeInt16BE(numValue * factor);
    return buffer;
}

exports.createBuffer32 = function (numValue, factor) {
    let buffer = Buffer.alloc(4);
    buffer.writeUInt32BE(numValue * factor);
    return buffer;
}