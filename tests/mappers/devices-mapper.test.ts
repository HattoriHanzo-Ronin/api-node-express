import { describe, expect, it } from "vitest";
import DefaultDevicesMapper from "../../src/mappers/impl/default-devices-mapper.js";
import type RouterAutomation from "../../src/utils/devices-routers/automation/router-automation.js";
import type { Device } from "../../src/types/devices-model.js";
import type { RouterAutomationPayload } from "../../src/types/router-automation.js";

class RouterAutomationStub implements RouterAutomation {
    constructor({}: { router: RouterAutomationPayload }) {}

    getCapabilities() { return { addAllow: true, deleteAllow: true }; }
    generateKey() { return null; }
    async create() {}
    async delete() {}
}

const MAPPER = new DefaultDevicesMapper({ routerAutomation: RouterAutomationStub });
const DEVICE: Device = {
    id: "1", name: "Desktop", type: "CLIENT", model: null, ip: null, ssid: null,
    wifi_pass: null, admin_pass: null, mac_filter: null
};

describe("DevicesMapper", () => {
    it("removes null persistence fields and attaches connections", () => {
        const connections = [{ mac: "AA:BB:CC:DD:EE:01", ctype: "LAN" as const }];
        expect(MAPPER.deviceToDomain({ source: DEVICE, connections })).toEqual({
            id: "1", name: "Desktop", type: "CLIENT", connections
        });
    });

    it("groups connections without duplicating devices", () => {
        const rows = [
            { id: "1", name: "Desktop", type: "CLIENT" as const, model: null, ctype: "LAN" as const, mac: "AA:BB:CC:DD:EE:01" },
            { id: "1", name: "Desktop", type: "CLIENT" as const, model: null, ctype: "WIFI" as const, mac: "AA:BB:CC:DD:EE:02" }
        ];
        expect(MAPPER.createDeviceSource(rows)).toEqual({
            devices: [{ id: "1", name: "Desktop", type: "CLIENT", model: null }],
            connections: [
                { device_id: "1", ctype: "LAN", mac: "AA:BB:CC:DD:EE:01" },
                { device_id: "1", ctype: "WIFI", mac: "AA:BB:CC:DD:EE:02" }
            ]
        });
    });
});
