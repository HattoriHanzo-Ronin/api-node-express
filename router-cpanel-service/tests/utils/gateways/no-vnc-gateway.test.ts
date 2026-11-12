import { once } from "node:events";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { WebSocket } from "ws";
import { describe, expect, it, vi } from "vitest";
import NoVncGateway from "../../../src/utils/gateways/impl/no-vnc-gateway.js";
import ApiError from "../../../src/utils/error/api-error.js";
import type RouterSessionService from "../../../src/services/router-session-service.js";
import type { Socket } from "node:net";

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../../../src/utils/logger/logger.js", () => ({ default: { getLogger: () => logger } }));

describe("NoVncGateway", () => {
    it("does not log an already transformed connection failure again", async () => {
        const error = new ApiError({ message: "VNC unavailable", cause: new Error("connection failed") });
        const routerSessionService = { openVncSocket: vi.fn().mockRejectedValue(error) };
        const gateway = new NoVncGateway({
            routerSessionService: routerSessionService as unknown as RouterSessionService<Socket>
        });
        const server = createServer();
        gateway.attach({ server });
        await new Promise<void>((resolve) => server.listen(0, resolve));
        vi.clearAllMocks();
        try {
            const { port } = server.address() as AddressInfo;
            const socket = new WebSocket(`ws://127.0.0.1:${port}/vnc/session/socket?token=private-token`);
            const [code] = await once(socket, "close");
            expect(code).toBe(1008);
            expect(logger.error).not.toHaveBeenCalled();
            expect(logger.info).not.toHaveBeenCalled();
        } finally {
            gateway.close();
            await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        }
    });

    it("records an unexpected connection failure without exposing it to the client", async () => {
        const error = new Error("VNC unavailable");
        const routerSessionService = { openVncSocket: vi.fn().mockRejectedValue(error) };
        const gateway = new NoVncGateway({
            routerSessionService: routerSessionService as unknown as RouterSessionService<Socket>
        });
        const server = createServer();
        gateway.attach({ server });
        await new Promise<void>((resolve) => server.listen(0, resolve));
        try {
            const { port } = server.address() as AddressInfo;
            const socket = new WebSocket(`ws://127.0.0.1:${port}/vnc/session/socket?token=private-token`);
            const [code, reason] = await once(socket, "close");
            expect(code).toBe(1008);
            expect(reason.toString()).toBe("Sesión no válida");
            expect(logger.error).toHaveBeenCalledWith(
                expect.objectContaining({ event: "router.vnc.connection_failed", error })
            );
        } finally {
            gateway.close();
            await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
        }
    });
});
