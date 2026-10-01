import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { execFile } from "node:child_process";
import { createReadStream } from "node:fs";
import { mkdtemp, rm, stat } from "node:fs/promises";
import { createServer } from "node:http";
import { tmpdir } from "node:os";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

describe("ThumbnailService", () => {
    const origins = [];
    const paths = [];
    const ranges = [];
    let fixtureDir;
    let fixture;
    let server;
    let service;

    beforeAll(async () => {
        fixtureDir = await mkdtemp(path.join(tmpdir(), "thumbnail-generator-test-"));
        fixture = path.join(fixtureDir, "video.mp4");
        await promisify(execFile)(ffmpegPath, [
            "-f", "lavfi", "-i", "testsrc2=s=640x360", "-t", "1", "-c:v", "mpeg4", fixture
        ]);
        const { size } = await stat(fixture);
        server = createServer(async (request, response) => {
            paths.push(request.url);
            origins.push(request.headers.origin);
            ranges.push(request.headers.range);
            const { start, end, partial } = getRange(request.headers.range, size);
            const headers = { "Accept-Ranges": "bytes", "Content-Length": end - start + 1 };
            if (partial) {
                headers["Content-Range"] = `bytes ${start}-${end}/${size}`;
            }

            response.writeHead(partial ? 206 : 200, headers);
            if (request.method === "HEAD") {
                response.end();
                return;
            }

            await pipeline(createReadStream(fixture, { start, end }), response);
        });
        await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
        process.env.API_URL = `http://127.0.0.1:${server.address().port}`;
        process.env.THUMBNAIL_GENERATOR_URL = "http://thumbnail-generator:3000";
        ({ default: service } = await import("../../src/services/thumbnail-service.js"));
    });

    afterAll(async () => {
        await new Promise((resolve) => server?.close(resolve) ?? resolve());
        if (fixtureDir) {
            await rm(fixtureDir, { recursive: true, force: true });
        }
    });

    it("should create a JPEG using HTTP range requests", async () => {
        const thumbnail = await service.create("550e8400-e29b-41d4-a716-446655440000");
        expect(thumbnail.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
        expect(ranges.some(Boolean)).toBe(true);
        expect(origins.every((origin) => origin === "http://thumbnail-generator:3000")).toBe(true);
        expect(paths).toContain("/ftp/media/550e8400-e29b-41d4-a716-446655440000");
    });
});

function getRange(source, size) {
    const range = source?.match(/^bytes=(\d*)-(\d*)$/);
    if (!range) {
        return { start: 0, end: size - 1, partial: false };
    }

    if (!range[1]) {
        const length = Math.min(Number(range[2]), size);
        return { start: size - length, end: size - 1, partial: true };
    }

    const start = Number(range[1]);
    const end = range[2] ? Math.min(Number(range[2]), size - 1) : size - 1;
    return { start, end, partial: true };
}
