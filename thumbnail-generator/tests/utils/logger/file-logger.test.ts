import { closeSync, openSync, mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("node:fs", async (importOriginal) => {
    const original = await importOriginal<typeof import("node:fs")>();
    return { ...original, openSync: vi.fn(original.openSync), closeSync: vi.fn(original.closeSync) };
});
const environment = vi.hoisted(() => ({ logLevel: "info", logDirectory: "", logRetentionWeeks: 8 }));
vi.mock("../../../src/config/environment.js", () => ({ ENV: environment }));
import ApiError from "../../../src/utils/error/api-error.js";

describe("Logger", () => {
    let directory: string;
    let Logger: typeof import("../../../src/utils/logger/logger.js").default;

    beforeEach(async () => {
        vi.resetModules();
        directory = mkdtempSync(path.join(tmpdir(), "thumbnail-log-"));
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-01-04T23:59:59.000Z"));
        environment.logLevel = "info";
        environment.logDirectory = directory;
        environment.logRetentionWeeks = 8;
        ({ default: Logger } = await import("../../../src/utils/logger/logger.js"));
    });

    afterEach(() => {
        for (const result of vi.mocked(openSync).mock.results) {
            if (result.type === "return") {
                try {
                    closeSync(result.value);
                } catch {}
            }
        }

        vi.mocked(openSync).mockClear();
        vi.useRealTimers();
        rmSync(directory, { recursive: true, force: true });
    });

    it("writes filtered JSON records to UTC daily files and appends after restart", async () => {
        const logger = Logger.getLogger({ name: "first" });
        logger.debug({ event: "ignored", message: "ignored" });
        logger.info({ event: "first", message: "first", context: "User: user-id, limit: 4" });
        Logger.getLogger({ name: "another" });
        expect(vi.getTimerCount()).toBe(1);
        vi.resetModules();
        const { default: RestartedLogger } = await import("../../../src/utils/logger/logger.js");
        RestartedLogger.getLogger({ name: "second" }).warn({ event: "second", message: "second" });
        vi.setSystemTime(new Date("2026-01-05T00:00:00.000Z"));
        logger.info({ event: "third", message: "third" });
        const records = readFileSync(path.join(directory, "2026-01", "2026-01-04.log"), "utf8")
            .trim()
            .split("\n")
            .map((line) => JSON.parse(line));
        expect(records.map(({ event }) => event)).toEqual(["first", "second"]);
        expect(records[0]).toMatchObject({
            timestamp: "2026-01-04T23:59:59.000Z",
            level: "info",
            service: "thumbnail-generator",
            source: "first",
            context: "User: user-id, limit: 4"
        });
        expect(JSON.parse(readFileSync(path.join(directory, "2026-01", "2026-01-05.log"), "utf8")).event).toBe("third");
    });

    it("shares the daily file between loggers and closes it on rotation", () => {
        vi.mocked(openSync).mockClear();
        vi.mocked(closeSync).mockClear();
        const first = Logger.getLogger({ name: "first" });
        const second = Logger.getLogger({ name: "second" });
        first.info({ event: "first", message: "first" });
        second.info({ event: "second", message: "second" });
        expect(openSync).toHaveBeenCalledTimes(1);
        expect(closeSync).not.toHaveBeenCalled();
        vi.setSystemTime(new Date("2026-01-05T00:00:00.000Z"));
        second.info({ event: "third", message: "third" });
        expect(openSync).toHaveBeenCalledTimes(2);
        expect(closeSync).toHaveBeenCalledTimes(1);
    });

    it("cleans expired dates across years without touching unrelated files", () => {
        for (const month of ["2025-10", "2025-11", "2026-01"]) {
            mkdirSync(path.join(directory, month));
        }

        writeFileSync(path.join(directory, "2025-10", "2025-10-31.log"), "old");
        writeFileSync(path.join(directory, "2025-11", "2025-11-03.log"), "keep");
        writeFileSync(path.join(directory, "2025-11", "unrelated.txt"), "keep");
        writeFileSync(path.join(directory, "2026-01", "2026-01-04.log"), "current");
        Logger.getLogger({ name: "test" });
        expect(existsSync(path.join(directory, "2025-10"))).toBe(false);
        expect(existsSync(path.join(directory, "2025-11", "2025-11-03.log"))).toBe(true);
        expect(existsSync(path.join(directory, "2025-11", "unrelated.txt"))).toBe(true);
        expect(existsSync(path.join(directory, "2026-01", "2026-01-04.log"))).toBe(true);
        vi.advanceTimersByTime(1000);
        expect(existsSync(path.join(directory, "2025-11", "2025-11-03.log"))).toBe(false);
    });

    it("serializes causes and redacts sensitive context and circular values", () => {
        const logger = Logger.getLogger({ name: "test" });
        const cause = new Error('connection failed {"password":"private-value"}');
        const context: Record<string, unknown> = { password: "secret", authorization: "bearer-value", original: cause };
        context.self = context;
        const error = new ApiError({ message: "failed", cause, context });
        for (let index = 0; index < 60; index += 1) {
            Object.defineProperty(error, `extra${index}`, { value: index, enumerable: true });
        }
        logger.error({ event: "failure", message: "failed", error });
        const record = JSON.parse(readFileSync(path.join(directory, "2026-01", "2026-01-04.log"), "utf8"));
        expect(record.error.cause.message).toBe('connection failed {"password":[redacted]}');
        expect(record.error.cause.stack).toBeDefined();
        expect(record.error.context).toMatchObject({
            password: "[redacted]",
            authorization: "[redacted]",
            self: "[circular]"
        });
        expect(() => ApiError.handle([{ condition: true, message: "wrapped", cause: error }])).toThrowError(
            expect.objectContaining({ cause: error })
        );
    });

    it("does not interrupt work when the log directory cannot be written", () => {
        const file = path.join(directory, "file");
        writeFileSync(file, "not a directory");
        environment.logDirectory = file;
        const logger = Logger.getLogger({ name: "test" });
        expect(() => logger.info({ event: "test", message: "test" })).not.toThrow();
    });
});
