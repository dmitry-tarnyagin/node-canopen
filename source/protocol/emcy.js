/**
 * @file Implements the CANopen Emergency (EMCY) protocol.
 * @author Wilkins White
 * @copyright 2024 Daxbot
 */

const EventEmitter = require('events');
const { Eds, EdsError } = require('../eds');
const { deprecate } = require('util');

/**
 * CANopen emergency error code classes.
 *
 * @enum {number}
 * @see CiA301 "Emergency object (EMCY)" (§7.2.7)
 * @memberof EmcyMessage
 */
const EmcyType = {
    /** Error reset or no error. */
    ERROR_RESET: 0x0000,

    /** Generic error. */
    GENERIC_ERROR: 0x1000,

    /** Current error. */
    CURRENT_GENERAL: 0x2000,

    /** Current error, CANopen device input side. */
    CURRENT_INPUT: 0x2100,

    /** Current error inside the CANopen device. */
    CURRENT_INTERNAL: 0x2200,

    /** Current error, CANopen device output side. */
    CURRENT_OUTPUT: 0x2300,

    /** Voltage error. */
    VOLTAGE_GENERAL: 0x3000,

    /** Voltage error, mains. */
    VOLTAGE_MAINS: 0x3100,

    /** Voltage error inside the CANopen device. */
    VOLTAGE_INTERNAL: 0x3200,

    /** Voltage error, CANopen device output side. */
    VOLTAGE_OUTPUT: 0x3300,

    /** Temperature error. */
    TEMPERATURE_GENERAL: 0x4000,

    /** Temperature error, ambient. */
    TEMPERATURE_AMBIENT: 0x4100,

    /** Temperature error, CANopen device. */
    TEMPERATURE_DEVICE: 0x4200,

    /** CANopen device hardware error. */
    HARDWARE: 0x5000,

    /** CANopen device software error. */
    SOFTWARE_GENERAL: 0x6000,

    /** Internal software error. */
    SOFTWARE_INTERNAL: 0x6100,

    /** User software error. */
    SOFTWARE_USER: 0x6200,

    /** Data set error. */
    SOFTWARE_DATA: 0x6300,

    /** Additional modules error. */
    MODULES: 0x7000,

    /** Monitoring error. */
    MONITORING: 0x8000,

    /** Monitoring error, communication. */
    COMMUNICATION: 0x8100,

    /** Monitoring error, protocol. */
    PROTOCOL: 0x8200,

    /** External error. */
    EXTERNAL: 0x9000,

    /** Additional functions error. */
    ADDITIONAL_FUNCTIONS: 0xf000,

    /** CANopen device specific error. */
    DEVICE_SPECIFIC: 0xff00,
};

/**
 * CANopen emergency error codes.
 *
 * @enum {number}
 * @see CiA301 "Emergency object (EMCY)" (§7.2.7)
 * @memberof EmcyMessage
 */
const EmcyCode = {
    /** CAN overrun (objects lost). */
    CAN_OVERRUN: EmcyType.COMMUNICATION | 0x10,

    /** CAN in error passive mode. */
    BUS_PASSIVE: EmcyType.COMMUNICATION | 0x20,

    /** Life guard or heartbeat error. */
    HEARTBEAT: EmcyType.COMMUNICATION | 0x30,

    /** CAN recovered from bus off. */
    BUS_OFF_RECOVERED: EmcyType.COMMUNICATION | 0x40,

    /** CAN-ID collision. */
    CAN_ID_COLLISION: EmcyType.COMMUNICATION | 0x50,

    /** PDO not processed due to length error. */
    PDO_LENGTH: EmcyType.PROTOCOL | 0x10,

    /** PDO length exceeded. */
    PDO_LENGTH_EXCEEDED: EmcyType.PROTOCOL | 0x20,

    /** DAM MPDO not processed, destination object not available. */
    DAM_MPDO: EmcyType.PROTOCOL | 0x30,

    /** Unexpected SYNC data length. */
    SYNC_LENGTH: EmcyType.PROTOCOL | 0x40,

    /** RPDO timed out. */
    RPDO_TIMEOUT: EmcyType.PROTOCOL | 0x50,

    /** Unexpected TIME data length. */
    TIME_LENGTH: EmcyType.PROTOCOL | 0x60,
};

/**
 * Structure for storing and parsing CANopen emergency objects.
 *
 * @param {object} obj - arguments.
 * @param {EmcyCode} obj.code - error code.
 * @param {number} obj.register - error register (Object 0x1001).
 * @param {Buffer} obj.info - error info.
 */
class EmcyMessage {
    constructor({ code, register, info }) {
        this.code = code;
        this.register = register || 0;
        this.info = Buffer.alloc(5);

        if (info) {
            if (!Buffer.isBuffer(info) || info.length > 5)
                throw TypeError('info must be a Buffer of length [0-5]');

            info.copy(this.info);
        }
    }

    /**
     * Convert to a string.
     *
     * @returns {string} string representation.
     */
    toString() {
        // Check codes
        switch (this.code) {
            case EmcyCode.CAN_OVERRUN:
                return 'CAN overrun';
            case EmcyCode.BUS_PASSIVE:
                return 'CAN in error passive mode';
            case EmcyCode.HEARTBEAT:
                return 'Life guard or heartbeat error';
            case EmcyCode.BUS_OFF_RECOVERED:
                return 'Recovered from bus off';
            case EmcyCode.CAN_ID_COLLISION:
                return 'CAN-ID collision';
            case EmcyCode.PDO_LENGTH:
                return 'PDO not processed due to length error';
            case EmcyCode.PDO_LENGTH_EXCEEDED:
                return 'PDO length exceeded';
            case EmcyCode.DAM_MPDO:
                return 'DAM MPDO not processed, destination object not available';
            case EmcyCode.SYNC_LENGTH:
                return 'Unexpected SYNC data length';
            case EmcyCode.RPDO_TIMEOUT:
                return 'RPDO timeout';
            case EmcyCode.TIME_LENGTH:
                return 'Unexpected TIME data length';
        }

        // Check class
        switch (this.code & 0xff00) {
            case EmcyType.ERROR_RESET:
                return 'Error reset';
            case EmcyType.GENERIC_ERROR:
                return 'Generic error';
            case EmcyType.CURRENT_GENERAL:
                return 'Current error';
            case EmcyType.CURRENT_INPUT:
                return 'Current, CANopen device input side';
            case EmcyType.CURRENT_INTERNAL:
                return 'Current inside the CANopen device';
            case EmcyType.CURRENT_OUTPUT:
                return 'Current, CANopen device output side';
            case EmcyType.VOLTAGE_GENERAL:
                return 'Voltage error';
            case EmcyType.VOLTAGE_MAINS:
                return 'Voltage mains';
            case EmcyType.VOLTAGE_INTERNAL:
                return 'Voltage inside the CANopen device';
            case EmcyType.VOLTAGE_OUTPUT:
                return 'Voltage output';
            case EmcyType.TEMPERATURE_GENERAL:
                return 'Temperature error';
            case EmcyType.TEMPERATURE_AMBIENT:
                return 'Ambient temperature';
            case EmcyType.HARDWARE:
                return 'CANopen device hardware';
            case EmcyType.SOFTWARE_GENERAL:
                return 'CANopen device software';
            case EmcyType.SOFTWARE_INTERNAL:
                return 'Internal software';
            case EmcyType.SOFTWARE_USER:
                return 'User software';
            case EmcyType.SOFTWARE_DATA:
                return 'Data set';
            case EmcyType.MODULES:
                return 'Additional modules';
            case EmcyType.MONITORING:
                return 'Monitoring error';
            case EmcyType.COMMUNICATION:
                return 'Communication error';
            case EmcyType.PROTOCOL:
                return 'Protocol error';
            case EmcyType.EXTERNAL:
                return 'External error';
            case EmcyType.ADDITIONAL_FUNCTIONS:
                return 'Additional functions';
            case EmcyType.DEVICE_SPECIFIC:
                return 'CANopen device specific';
        }

        return `Unknown error (0x${this.code.toString(16)})`;
    }

    /**
     * Convert to a Buffer.
     *
     * @returns {Buffer} encoded data.
     */
    toBuffer() {
        let data = Buffer.alloc(8);
        data.writeUInt16LE(this.code);
        data.writeUInt8(this.register, 2);
        this.info.copy(data, 3);

        return data;
    }

    /**
     * Returns true if the object is an instance of EmcyMessage.
     *
     * @param {object} obj - object to test.
     * @returns {boolean} true if obj is an EmcyMessage.
     */
    static isMessage(obj) {
        return obj instanceof EmcyMessage;
    }
}

/**
 * CANopen EMCY protocol handler.
 *
 * The emergency (EMCY) protocol follows a producer-consumer structure where
 * emergency objects are used to indicate CANopen device errors. An emergency
 * object should be transmitted only once per error event.
 *
 * This class implements the EMCY write service for producing emergency objects.
 *
 * @param {Eds} eds - Eds object.
 * @see CiA301 "Emergency object" (§7.2.7)
 * @fires 'message' on preparing a CAN message to send.
 * @fires 'emergency' on consuming an emergency object.
 */
class Emcy extends EventEmitter {
    constructor(eds) {
        super();

        if(!Eds.isEds(eds))
            throw new TypeError('not an Eds');

        this.eds = eds;
        this.sendQueue = [];
        this.sendTimer = null;
    }

    /**
     * Error register (Object 0x1001).
     *
     * @type {number}
     */
    get register() {
        const obj1001 = this.eds.getEntry(0x1001);
        if (obj1001)
            return obj1001.value;

        return null;
    }

    /**
     * Error history (Object 0x1003).
     *
     * @type {Array<object>} [{ code, info } ... ]
     */
    get history() {
        return this.eds.getEmcyHistory();
    }

    /**
     * Emcy valid bit (Object 0x1014, bit 31).
     *
     * @type {boolean}
     */
    get valid() {
        const obj1014 = this.eds.getEntry(0x1014);
        if(obj1014)
            return !((obj1014.value >> 31) & 0x1);

        return false;
    }

    /**
     * Emcy COB-ID (Object 0x1014, bits 0-28).
     *
     * @type {number}
     */
    get cobId() {
        const obj1014 = this.eds.getEntry(0x1014);
        if(obj1014)
            return obj1014.value & 0x7FF;

        return null;
    }

    /**
     * Emcy inhibit time in ms (Object 0x1015).
     *
     * @type {number}
     */
    get inhibitTime() {
        const obj1015 = this.eds.getEntry(0x1015);
        if (obj1015)
            return obj1015.value / 10; // 100 μs

        return null;
    }

    /**
     * Emergency consumer object (Object 0x1028).
     *
     * @type {Array<number>}
     */
    get consumers() {
        return this.eds.getEmcyConsumers();
    }

    /**
     * Start the module.
     */
    start() {
        if(this.sendTimer !== null)
            return;

        const delay = this.inhibitTime;
        if(delay) {
            this.sendTimer = setInterval(() => {
                if(this.sendQueue.length > 0)
                    this.emit('message', this.sendQueue.shift());
            }, delay);
        }
    }

    /**
     * Stop the module.
     */
    stop() {
        clearInterval(this.sendTimer);
        this.sendTimer = null;
    }

    /**
     * Service: EMCY write.
     *
     * @param {object} args - arguments.
     * @param {number} args.code - error code.
     * @param {Buffer} args.info - error info.
     */
    write(...args) {
        if (!this.cobId)
            throw new EdsError('EMCY production is disabled');

        if(args.length > 1) {
            args = {
                code: args[0],
                info: args[1],
            };
        }
        else {
            args = args[0];
        }

        const { code, info } = args;
        const em = new EmcyMessage({
            code,
            register: this.register,
            info
        });

        const message = {
            id: this.cobId,
            data: em.toBuffer(),
        };

        if(this.sendTimer)
            this.sendQueue.push(message);
        else
            this.emit('message', message);
    }

    /**
     * Call when a new CAN message is received.
     *
     * @param {object} message - CAN frame.
     * @param {number} message.id - CAN message identifier.
     * @param {Buffer} message.data - CAN message data;
     * @param {number} message.len - CAN message length in bytes.
     */
    receive(message) {
        if (message.data.length != 8)
            return;

        for (let id of this.consumers) {
            if (id === message.id) {
                this.emit('emergency', {
                    cobId: message.id,
                    em: new EmcyMessage({
                        code: message.data.readUInt16LE(0),
                        register: message.data.readUInt8(2),
                        info: message.data.subarray(3),
                    }),
                });
                break;
            }
        }
    }

    ////////////////////////////// Deprecated //////////////////////////////

    /**
     * Initialize members and begin emergency monitoring.
     *
     * @deprecated
     */
    init() {
        deprecate(() => this.start(),
            'init() is deprecated. Use start() instead');
    }

    /**
     * Configures the number of sub-entries for 0x1003 (Pre-defined error field).
     *
     * @param {number} length - how many historical error events should be kept.
     * @deprecated
     */
    setHistoryLength(length) {
        deprecate(() => this.eds.setEmcyHistoryLength(length),
            'setHistoryLength is deprecated. Use Eds method instead.');
    }
}

module.exports = exports = { EmcyType, EmcyCode, EmcyMessage, Emcy };
