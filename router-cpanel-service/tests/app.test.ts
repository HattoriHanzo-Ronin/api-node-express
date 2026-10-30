import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";
import type { Server } from "node:http";

import { createApp } from "../src/app.js";
import type { RouterSessionController } from "../src/controllers/router-session-controller.js";
import type { ExpressRouterSessionControllerHandlers } from "../src/types/default-router-session-controller.js";

describe("router control panel application", () => {
    let server: Server;
    let url: string;

    beforeEach(async () => {
        const routerSessionController: RouterSessionController<ExpressRouterSessionControllerHandlers> = {
            create: async (req, res) =>
                res.status(201).json({
                    id: "session-id",
                    url: "https://router-cpanel.example/viewer",
                    expiresAt: "2026-10-30T00:00:00.000Z"
                }),
            delete: async (req, res) => res.status(204).send(),
            navigate: async (req, res) => res.status(204).send(),
            markInteraction: async (req, res) => res.status(204).send(),
            streamStatus: async () => {}
        };
        server = createServer(createApp({ routerSessionController }));
        await new Promise<void>((resolve) => server.listen(0, resolve));
        const address = server.address();
        if (!address || typeof address === "string") {
            throw new Error("Test server does not expose a TCP address");
        }

        const { port } = address;
        url = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
        await new Promise<void>((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    });

    it("should create an internal session request", async () => {
        const response = await fetch(`${url}/sessions`, {
            method: "POST"
        });
        expect(response.status).toBe(201);
    });

    it("should return the standard response for unmatched routes", async () => {
        const response = await fetch(`${url}/missing`);
        expect(response.status).toBe(404);
        await expect(response.json()).resolves.toEqual({ code: "ROUTE_NOT_FOUND", message: "Page not found" });
    });
});
