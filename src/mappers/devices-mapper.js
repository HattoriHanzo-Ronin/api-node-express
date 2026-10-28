/**
 * Maps device data between persistence and domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesMapper {
    constructor({ routerAutomation }) {
        this.routerAutomation = routerAutomation;
    }

    /**
     * Creates a device source from persistence source
     *
     * @param {Object[]} source Persistence source
     * @returns {{ devices: Object[], connections: Object[] }} Devices source
     */
    createDeviceSource(source) {
        const connections = [];
        const deviceIds = new Set();
        const devices = source
            .map(({ ctype, mac, ...device }) => {
                connections.push({ device_id: device.id, ctype, mac });
                return device;
            })
            .filter(({ id }) => {
                if (deviceIds.has(id)) {
                    return false;
                }

                deviceIds.add(id);
                return true;
            });
        return { devices, connections };
    }

    /**
     * Maps a persistence device to the domain model
     *
     * @param {Object} source Persistence device
     * @returns {Object} Domain device
     */
    deviceToDomain(source) {
        let { connections, ...device } = source;
        connections = connections
            .filter(({ device_id: deviceId }) => deviceId === device.id)
            .map(({ mac, ctype }) => ({ mac, ctype }));
        device = Object.fromEntries(Object.entries(device).filter(([, value]) => value !== null));
        if (device.mac_filter) {
            const routerImpl = new this.routerAutomation({ router: device });
            device = { ...device, capabilities: routerImpl.getCapabilities() };
        }

        return { ...device, connections };
    }

    /**
     * Maps persistence devices to the domain model
     *
     * @param {{ devices: Object[], connections: Object[] }} source Persistence devices and connections
     * @returns {Object[]} Domain devices
     */
    devicesToDomain(source) {
        const { devices, connections } = source;
        return devices.map((device) => this.deviceToDomain({ ...device, connections }));
    }
}
