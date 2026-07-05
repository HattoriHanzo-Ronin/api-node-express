import RouterResolver from "../devices-routers/router-resolver.js";

/**
 * Maps device data between persistence and domain representations
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesMapper {
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
     * @param {Object[]} source Persistence devices
     * @returns {Object[]} Domain devices
     */
    static devicesToDomain(source) {
        const { devices, connections } = source;
        return devices.map((device) => this.deviceToDomain({ ...device, connections }));
    }
}
