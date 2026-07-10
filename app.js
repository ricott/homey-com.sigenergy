'use strict';

const { App } = require('homey');
const utilFunctions = require('./lib/util.js');
const logger = require('./lib/logger.js');

class SigenergyApp extends App {
    async onInit() {
        // Optional, anonymous error reporting (Sentry). Enabled only when a
        // SENTRY_DSN is present in env.json; a no-op otherwise. Used to size how
        // many installs/device types are hit by Modbus drop-out issues.
        try {
            const telemetryEnabled = logger.init(this.homey);
            this.log(`Telemetry ${telemetryEnabled ? 'enabled' : 'disabled'}, Node ${process.version}`);
        } catch (err) {
            this.error(`Failed to initialize telemetry: ${utilFunctions.formatError(err)}`);
        }

        // Safety net: log any stray unhandled promise rejection readably instead
        // of letting a non-Error rejection (e.g. a jsmodbus error, which is a
        // plain object) surface as an unreadable '[object Object]' crash report.
        // The underlying causes are transient Modbus errors that are already
        // handled per-device, so logging here also avoids needless crash loops.
        if (!SigenergyApp.unhandledRejectionHandlerInstalled) {
            SigenergyApp.unhandledRejectionHandlerInstalled = true;
            process.on('unhandledRejection', (reason) => {
                this.error(`Unhandled promise rejection: ${utilFunctions.formatError(reason)}`);
            });
        }

        await this.loadConditions();
        await this.loadActions();
        this.log(`Sigenergy v${this.getAppVersion()} has been initialized`);
    }

    async onUninit() {
        // Give Sentry a moment to send any buffered events before shutdown.
        await logger.flush();
    }

    getAppVersion() {
        return this.homey.manifest.version;
    }

    async loadConditions() {
        this.log('Loading conditions...');

    }

    async loadActions() {
        this.log('Loading actions...');

    }
}
module.exports = SigenergyApp;
