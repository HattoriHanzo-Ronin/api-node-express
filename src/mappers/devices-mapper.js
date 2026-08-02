import RouterResolver from "../devices-routers/router-resolver.js";

/**
 * Maps device data between persistence and domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesMapper {
    /**
     * Creates a device source from persistence source
     *
     * @param {Object[]} source Persistence source
     * @returns {{ devices: Object[], connections: Object[] }} Devices source
     */
    static createDeviceSource(source) {
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
    static deviceToDomain(source) {
        let { connections, ...device } = source;
        connections = connections
            .filter(({ device_id: deviceId }) => deviceId === device.id)
            .map(({ mac, ctype }) => ({ mac, ctype }));
        device = Object.fromEntries(Object.entries(device).filter(([, it]) => it !== null));
        if (device.mac_filter) {
            const routerImpl = new RouterResolver(device);
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
    static devicesToDomain(source) {
        const { devices, connections } = source;
        return devices.map((device) => this.deviceToDomain({ ...device, connections }));
    }
}
