import { describe, expect, it, vi } from "vitest";
import RouterAutomation from "../../../../src/utils/devices-routers/automation/router-automation.js";

vi.mock("../../../../src/config/environment.js", () => ({ ENV: { chromePath: "/usr/bin/chromium" } }));

describe("RouterAutomation", () => {
    it.each([
        ["TP-Link TL-WDR5620 Gigabit Edition"],
        ["TP-Link Archer AX53"]
    ])("should create automation for %s", (model) => {
        const router = new RouterAutomation({ router: { name: "Router", model } });

        expect(router.getCapabilities()).toEqual({ addAllow: true, deleteAllow: true });
    });

    it("should fail when no implementation is available", () => {
        expect(() => new RouterAutomation({ router: { name: "Router", model: "Unknown" } })).toThrow(
            "Router no tiene implementación disponible"
        );
    });
});
