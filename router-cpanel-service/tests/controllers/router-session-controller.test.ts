import { createServer } from "node:http";
import express from "express";
import type { RequestHandler } from "express";
import { describe, expect, it, vi } from "vitest";
import { DefaultRouterSessionController } from "../../src/controllers/impl/default-router-session-controller.js";
import type { RouterSessionService } from "../../src/services/router-session-service.js";
import type { RouterSessionResponse } from "../../src/types/router-session-service.js";

describe("RouterSessionController", () => {
    it("should pass the requested desktop client type to the session service", async () => {
        const routerSessionService = createRouterSessionService({ id: "session-id" });
        const controller = new DefaultRouterSessionController({ routerSessionService });
        const response = await request({
            handler: controller.create,
            method: "POST",
            path: "/",
            body: {
                ownerId: "user-id",
                routerName: "Router",
                routerIp: "192.168.1.1",
                routerPassword: "secret",
                language: "es-ES",
                clientType: "desktop",
                theme: "light"
            }
        });
        expect(routerSessionService.create).toHaveBeenCalledWith({
            ownerId: "user-id",
            routerName: "Router",
            routerIp: "192.168.1.1",
            routerPassword: "secret",
            language: "es-ES",
            clientType: "desktop",
            theme: "light"
        });
        expect(response.status).toBe(201);
        expect(response.body).toEqual({ id: "session-id" });
    });

    it("should pass the requested mobile client type to the session service", async () => {
        const routerSessionService = createRouterSessionService({ id: "session-id" });
        const controller = new DefaultRouterSessionController({ routerSessionService });
        await request({
            handler: controller.create,
            method: "POST",
            path: "/",
            body: {
                ownerId: "user-id",
                routerName: "Router",
                routerIp: "192.168.1.1",
                routerPassword: "secret",
                clientType: "mobile"
            }
        });
        expect(routerSessionService.create).toHaveBeenCalledWith({
            ownerId: "user-id",
            routerName: "Router",
            routerIp: "192.168.1.1",
            routerPassword: "secret",
            language: undefined,
            clientType: "mobile",
            theme: undefined
        });
    });

    it("should navigate a router session", async () => {
        const routerSessionService = createRouterSessionService();
        const controller = new DefaultRouterSessionController({ routerSessionService });
        const response = await request({
            handler: controller.navigate,
            method: "POST",
            path: "/session-id",
            body: { ownerId: "user-id", action: "back" }
        });
        expect(routerSessionService.navigate).toHaveBeenCalledWith({
            sessionId: "session-id",
            ownerId: "user-id",
            action: "back"
        });
        expect(response.status).toBe(204);
    });

    it("should close a router session for its owner", async () => {
        const routerSessionService = createRouterSessionService();
        const controller = new DefaultRouterSessionController({ routerSessionService });
        const response = await request({
            handler: controller.delete,
            method: "DELETE",
            path: "/session-id",
            body: { ownerId: "user-id" }
        });
        expect(routerSessionService.close).toHaveBeenCalledWith({ sessionId: "session-id", ownerId: "user-id" });
        expect(response.status).toBe(204);
    });
});

function createRouterSessionService(response?: Partial<RouterSessionResponse>): RouterSessionService<unknown> & {
    create: ReturnType<typeof vi.fn>;
    close: ReturnType<typeof vi.fn>;
    navigate: ReturnType<typeof vi.fn>;
} {
    return {
        create: vi.fn().mockResolvedValue(response),
        close: vi.fn().mockResolvedValue(undefined),
        navigate: vi.fn().mockResolvedValue(undefined),
        refresh: vi.fn(),
        openVncSocket: vi.fn(),
        subscribe: vi.fn(),
        markInteraction: vi.fn(),
        closeAll: vi.fn().mockResolvedValue(undefined)
    };
}

async function request<Params, ResBody, ReqBody, ReqQuery>({
    handler,
    method,
    path,
    body
}: {
    handler: RequestHandler<Params, ResBody, ReqBody, ReqQuery>;
    method: "POST" | "DELETE";
    path: string;
    body: object;
}): Promise<{ status: number; body: unknown }> {
    const app = express();
    app.use(express.json());
    if (method === "POST") {
        app.post<Params, ResBody, ReqBody, ReqQuery>(path === "/" ? "/" : "/:sessionId", handler);
    } else {
        app.delete<Params, ResBody, ReqBody, ReqQuery>("/:sessionId", handler);
    }

    const server = createServer(app);
    await new Promise<void>((resolve) => server.listen(0, resolve));
    const address = server.address();
    if (!address || typeof address === "string") {
        throw new Error("Test server does not expose a TCP address");
    }

    const { port } = address;
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
    });
    const responseBody = response.status === 204 ? undefined : await response.json();
    await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    return { status: response.status, body: responseBody };
}
