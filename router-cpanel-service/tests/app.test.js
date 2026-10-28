import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createServer } from "node:http";

import { createApp } from "../src/app.js";

describe("router control panel application", () => {
    let server;
    let url;

    beforeEach(async () => {
        const routerSessionController = {
            create: async (req, res) => res.status(201).json({ id: "session-id" }),
            delete: async (req, res) => res.status(204).send(),
            markInteraction: async (req, res) => res.status(204).send(),
            streamStatus: async () => {}
        };
        server = createServer(createApp({ routerSessionController }));
        await new Promise((resolve) => server.listen(0, resolve));
        const { port } = server.address();
        url = `http://127.0.0.1:${port}`;
    });

    afterEach(async () => {
        await new Promise((resolve) => server.close(resolve));
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
