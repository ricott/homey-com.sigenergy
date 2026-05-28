'use strict';

const BaseDriver = require('../baseDriver.js');
const { EvDCChargerRegistry } = require('../../lib/modbus/registry/evDCCharger.js');
const enums = require('../../lib/enums.js');

class EvDCChargerDriver extends BaseDriver {

    async onInit() {
        this._registerFlows();
    }

    _registerFlows() {
        this.log('Registering flows');

        // Trigger: DC charger state changed
        this._dc_charger_state_changed = this.homey.flow.getDeviceTriggerCard('dc_charger_state_changed');
        this._dc_charger_state_changed.registerRunListener(async (args, state) => {
            return Boolean(
                args.state?.name &&
                typeof state.value === 'string' &&
                args.state.name === state.value
            );
        });
        this._dc_charger_state_changed.registerArgumentAutocompleteListener('state',
            async (query, args) => {
                return enums.getDCChargerStates();
            }
        );

        // Action: Set max charging power
        this.homey.flow.getActionCard('set_max_charge_power')
            .registerRunListener(async (args) => {
                return await args.device.setMaxChargePower(args.power);
            });

        // Action: Set max discharging power
        this.homey.flow.getActionCard('set_max_discharge_power')
            .registerRunListener(async (args) => {
                return await args.device.setMaxDischargePower(args.power);
            });
    }

    async onPair(session) {
        return await super.pair(EvDCChargerRegistry.serial, 'EV DC Charger', session);
    }

}
module.exports = EvDCChargerDriver;
