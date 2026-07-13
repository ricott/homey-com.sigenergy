'use strict';

// Read a 64-bit big-endian unsigned integer. Buffer.readBigUInt64BE returns a
// BigInt; we convert to a Number because Homey capability values are numbers.
// Real-world values here (energy counters in 0.01 units) stay well below
// Number.MAX_SAFE_INTEGER, so the conversion is lossless in practice.
function readUInt64BE(buffer, offset = 0) {
    return Number(buffer.readBigUInt64BE(offset));
}

const type = {
    uint16_001: { format: 'uint16', factor: 0.01 },
    uint16_01: { format: 'uint16', factor: 0.1 },
    uint16_1: { format: 'uint16', factor: 1 },
    uint16_10: { format: 'uint16', factor: 10 },
    uint16_100: { format: 'uint16', factor: 100 },
    uint16_1000: { format: 'uint16', factor: 1000 },
    uint32_1: { format: 'uint32', factor: 1 },
    uint32_100: { format: 'uint32', factor: 100 },
    uint32_1000: { format: 'uint32', factor: 1000 },
    uint64_1: { format: 'uint64', factor: 1 },
    uint64_100: { format: 'uint64', factor: 100 },
    uint64_1000: { format: 'uint64', factor: 1000 },
    int16_001: { format: 'int16', factor: 0.01 },
    int16_01: { format: 'int16', factor: 0.1 },
    int16_1: { format: 'int16', factor: 1 },
    int16_10: { format: 'int16', factor: 10 },
    int16_100: { format: 'int16', factor: 100 },
    int32_1: { format: 'int32', factor: 1 },
    int32_100: { format: 'int32', factor: 100 },
    int32_1000: { format: 'int32', factor: 1000 },
    string: { format: 'string', factor: 0 }
};

const setting = {
    INFO: 'INFO',
    READING: 'READING',
    SYSTEM: 'SYSTEM'
}

class ModbusRegistry {
    constructor(setting, registryId, count, type, comment, capability) {
        this._setting = setting;
        this._registryId = registryId;
        this._count = count;
        this._type = type;
        this._comment = comment;
        this._capability = capability;
    }

    get registryId() {
        return this._registryId;
    }

    get count() {
        return this._count;
    }

    get comment() {
        return this._comment;
    }

    get setting() {
        return this._setting;
    }

    get capability() {
        return this._capability;
    }

    readData(dataBuffer) {
        if (dataBuffer) {
            if (this._type.format === 'uint64') {
                return readUInt64BE(dataBuffer, 0) / this._type.factor;
            } else if (this._type.format === 'uint32') {
                return dataBuffer.readUInt32BE(0) / this._type.factor;
            } else if (this._type.format === 'int32') {
                return dataBuffer.readInt32BE(0) / this._type.factor;
            } else if (this._type.format === 'uint16') {
                return dataBuffer.readUInt16BE(0) / this._type.factor;
            } else if (this._type.format === 'int16') {
                return dataBuffer.readInt16BE(0) / this._type.factor;
            } else if (this._type.format === 'string') {
                return dataBuffer.toString('utf8').replace(/\0/g, '').trim();
            }
        } else {
            return 0;
        }
    }
}

module.exports = {
    type,
    setting,
    ModbusRegistry
}