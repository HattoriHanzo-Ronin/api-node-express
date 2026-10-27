import { afterEach, describe, expect, it, vi } from "vitest";
import RouterCpanel from "../../../src/devices-routers/cpanel/router-cpanel.js";

describe("RouterCpanel", () => {
    afterEach(() => {
        vi.clearAllMocks();
        vi.unstubAllGlobals();
    });

    it("should forward session creation to the internal service", async () => {
        const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ id: "session-id" }), { status: 201 }));
        vi.stubGlobal("fetch", fetchMock);
        const routerCpanel = new RouterCpanel({ routerCpanelServiceUrl: "http://router-cpanel-service:3000" });
        await expect(routerCpanel.create({
            ownerId: "user-id",
            routerName: "Router",
            routerIp: "192.168.1.1",
            routerPassword: "secret",
            clientType: "mobile",
            theme: "dark"
        })).resolves.toEqual({ id: "session-id" });
        expect(fetchMock).toHaveBeenCalledWith(new URL("/sessions", "http://router-cpanel-service:3000"), expect.objectContaining({
            method: "POST",
            body: expect.stringContaining('"theme":"dark"')
        }));
    });

    it("should translate an unavailable internal service", async () => {
        vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("Connection refused")));
        const routerCpanel = new RouterCpanel({ routerCpanelServiceUrl: "http://router-cpanel-service:3000" });
        await expect(routerCpanel.close({ sessionId: "session-id", ownerId: "user-id" })).rejects.toMatchObject({
            code: "ROUTER_CPANEL_SERVICE_UNAVAILABLE",
            status: 500
        });
    });
});
