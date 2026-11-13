import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { describe, expect, it, vi } from "vitest";
import createApp from "../../src/app.js";
import ThumbnailController from "../../src/controllers/thumbnail-controller.js";

vi.mock("../../src/utils/logger/logger.js", () => ({ default: { getLogger: () => ({ error: vi.fn() }) } }));

describe("Thumbnail routes", () => {
    it("associates a thumbnail request and its completion with the same batch", async () => {
        const service = { create: vi.fn().mockResolvedValue(Buffer.from("image")), registerBatch: vi.fn() };
        const app = createApp({ thumbnailController: new ThumbnailController({ thumbnailService: service }) });
        const server = createServer(app);
        await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
        try {
            const { port } = server.address() as AddressInfo;
            const batch = "550e8400-e29b-41d4-a716-446655440000";
            const baseUrl = `http://127.0.0.1:${port}/thumbnail`;
            const registration = { id: batch, userId: "user-1", files: [{ id: "media-id", size: 42 }] };
            const registered = await fetch(`${baseUrl}/batches`, {
                method: "POST",
                headers: { "content-type": "application/json" },
                body: JSON.stringify(registration)
            });
            expect(registered.status).toBe(204);
            expect(service.registerBatch).toHaveBeenCalledWith(registration);
            const created = await fetch(`${baseUrl}/media-id`, {
                method: "POST",
                headers: { "X-Thumbnail-Batch-Id": batch }
            });
            expect(created.status).toBe(200);
            expect(service.create).toHaveBeenCalledWith(expect.objectContaining({ id: "media-id", batchId: batch }));
        } finally {
            await new Promise<void>((resolve, reject) => {
                server.close((error) => {
                    if (error) {
                        reject(error);
                        return;
                    }

                    resolve();
                });
            });
        }
    });
});
