import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import SocketSessionsService from "../../src/services/socket-sessions-service.js";

const testEnvironment = vi.hoisted(() => ({
    socketMaxConnections: 300,
    socketMaxConnectionsPerUser: 3,
    socketSessionInactivityTimeout: 15 * 60 * 1000
}));

vi.mock("../../src/config/environment.js", () => ({ ENV: testEnvironment }));

const authUser = { id: "user-id", exp: 1_900_000_000 };

describe("SocketSessionsService", () => {
    let service;

    beforeEach(() => {
        Object.assign(testEnvironment, {
            socketMaxConnections: 300,
            socketMaxConnectionsPerUser: 3,
            socketSessionInactivityTimeout: 15 * 60 * 1000
        });
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-10-28T00:00:00.000Z"));
        service = new SocketSessionsService();
    });

    afterEach(() => {
        service.closeAll();
        vi.useRealTimers();
    });

    it("should create a session with an expiration date", () => {
        const session = service.create({ authUser });
        expect(session.expiresAt).toBe("2026-10-28T00:15:00.000Z");
        expect(session.id).toMatch(/^[0-9a-f-]{36}$/);
    });

    it("should limit sessions per authenticated user", () => {
        service.create({ authUser });
        service.create({ authUser });
        service.create({ authUser });
        expect(() => service.create({ authUser })).toThrow(expect.objectContaining({ code: "SOCKET_SESSION_CAPACITY_REACHED" }));
    });

    it("should reject a refresh from another user", () => {
        const { id } = service.create({ authUser });
        expect(() => service.refresh({ authUser: { ...authUser, id: "other-user" }, id })).toThrow(
            expect.objectContaining({ code: "SOCKET_SESSION_INVALID" })
        );
    });

    it("should close a session after inactivity", async () => {
        const { id } = service.create({ authUser });
        await vi.advanceTimersByTimeAsync(15 * 60 * 1000);
        expect(() => service.refresh({ authUser, id })).toThrow(expect.objectContaining({ code: "SOCKET_SESSION_NOT_FOUND" }));
    });

    it("should close only the requested owned session", () => {
        const first = service.create({ authUser });
        const second = service.create({ authUser });
        service.close({ authUser, id: first.id });
        expect(() => service.refresh({ authUser, id: first.id })).toThrow();
        expect(service.refresh({ authUser, id: second.id })).toMatchObject({ id: second.id });
    });
});
