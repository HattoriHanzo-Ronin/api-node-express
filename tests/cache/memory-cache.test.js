import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE } from "../../src/config/constants.js";
import MemoryCache from "../../src/cache/memory-cache.js";

const MB = 1024 ** 2;
const sizedBuffer = (size) => ({ length: size });

describe("MemoryCache", () => {
    let cache;

    beforeEach(() => {
        vi.useFakeTimers();
        cache = new MemoryCache();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should set, get and delete cached entries", () => {
        const first = new Map([["first.jpg", Buffer.from("first")]]);
        const second = new Map([["second.jpg", Buffer.from("second")]]);
        cache.set("user-id", "/first", first);
        cache.set("user-id", "/second", second);
        expect(cache.has("user-id", "/first")).toBe(true);
        expect(cache.get("user-id", "/first")).toBe(first);
        cache.delete("user-id", "/first");
        expect(cache.has("user-id", "/first")).toBe(false);
        expect(cache.get("user-id", "/first")).toBeUndefined();
        expect(cache.get("user-id", "/second")).toBe(second);
        cache.delete("user-id", "/second");
        expect(cache.has("user-id", "/second")).toBe(false);
    });

    it("should calculate bytes, ignore null values and replace entries without counting their size twice", () => {
        const first = new Map([
            ["first.jpg", sizedBuffer(250 * MB)],
            ["unavailable.jpg", null]
        ]);
        const replacement = new Map([["first.jpg", sizedBuffer(250 * MB)]]);
        cache.set("user-id", "/first", first);
        cache.set("user-id", "/second", new Map([["second.jpg", sizedBuffer(150 * MB)]]));
        cache.set("user-id", "/first", replacement);
        expect(cache.get("user-id", "/first")).toBe(replacement);
        cache.set("user-id", "/third", new Map([["third.jpg", sizedBuffer(1)]]));
        expect(cache.has("user-id", "/second")).toBe(false);
        expect(cache.has("user-id", "/first")).toBe(true);
        expect(cache.has("user-id", "/third")).toBe(true);
    });

    it("should enforce the 400 MB limit per user", () => {
        expect(CACHE.maxSizePerUser).toBe(400 * MB);
        cache.set("user-id", "/first", new Map([["first.jpg", sizedBuffer(200 * MB)]]));
        cache.set("user-id", "/second", new Map([["second.jpg", sizedBuffer(200 * MB)]]));
        cache.set("user-id", "/third", new Map([["third.jpg", sizedBuffer(1)]]));
        expect(cache.has("user-id", "/first")).toBe(false);
        expect(cache.has("user-id", "/second")).toBe(true);
        expect(cache.has("user-id", "/third")).toBe(true);
    });

    it("should evict the least recently used entry", () => {
        cache.set("user-id", "/first", new Map([["first.jpg", sizedBuffer(200 * MB)]]));
        cache.set("user-id", "/second", new Map([["second.jpg", sizedBuffer(200 * MB)]]));
        cache.get("user-id", "/first");
        cache.set("user-id", "/third", new Map([["third.jpg", sizedBuffer(1)]]));
        expect(cache.has("user-id", "/first")).toBe(true);
        expect(cache.has("user-id", "/second")).toBe(false);
        expect(cache.has("user-id", "/third")).toBe(true);
    });

    it("should enforce the 2 GB global limit", () => {
        expect(CACHE.maxSize).toBe(2 * 1024 ** 3);
        for (let index = 1; index <= 5; index++) {
            cache.set(`user-${index}`, "/media", new Map([["media.jpg", sizedBuffer(400 * MB)]]));
        }
        cache.set("user-6", "/media", new Map([["media.jpg", sizedBuffer(49 * MB)]]));
        expect(cache.has("user-1", "/media")).toBe(false);
        for (let index = 2; index <= 6; index++) {
            expect(cache.has(`user-${index}`, "/media")).toBe(true);
        }
    });

    it("should evict entries from users with multiple entries first", () => {
        cache.set("user-1", "/media", new Map([["media.jpg", sizedBuffer(400 * MB)]]));
        cache.set("user-2", "/first", new Map([["first.jpg", sizedBuffer(200 * MB)]]));
        cache.set("user-2", "/second", new Map([["second.jpg", sizedBuffer(200 * MB)]]));
        for (let index = 3; index <= 5; index++) {
            cache.set(`user-${index}`, "/media", new Map([["media.jpg", sizedBuffer(400 * MB)]]));
        }
        cache.set("user-6", "/media", new Map([["media.jpg", sizedBuffer(49 * MB)]]));
        expect(cache.has("user-1", "/media")).toBe(true);
        expect(cache.has("user-2", "/first")).toBe(false);
        expect(cache.has("user-2", "/second")).toBe(true);
    });

    it("should evict a user's only entry when required by the global limit", () => {
        for (let index = 1; index <= 5; index++) {
            cache.set(`user-${index}`, "/media", new Map([["media.jpg", sizedBuffer(400 * MB)]]));
        }
        cache.get("user-1", "/media");
        cache.set("user-6", "/media", new Map([["media.jpg", sizedBuffer(49 * MB)]]));
        expect(cache.has("user-1", "/media")).toBe(true);
        expect(cache.has("user-2", "/media")).toBe(false);
    });

    it("should restart the inactivity timeout on get and set", () => {
        const first = new Map();
        cache.set("user-id", "/first", first);
        vi.advanceTimersByTime(4 * 60 * 1000);
        expect(cache.get("user-id", "/first")).toBe(first);
        vi.advanceTimersByTime(4 * 60 * 1000);
        expect(cache.has("user-id", "/first")).toBe(true);
        cache.set("user-id", "/second", new Map());
        vi.advanceTimersByTime(4 * 60 * 1000);
        expect(cache.has("user-id", "/second")).toBe(true);
        vi.advanceTimersByTime(60 * 1000);
        expect(cache.has("user-id", "/second")).toBe(false);
    });

    it("should delete an owner cache after five minutes of inactivity", () => {
        expect(CACHE.inactivityTimeout).toBe(5 * 60 * 1000);
        cache.set("owner-id", "/media", new Map());
        vi.advanceTimersByTime(5 * 60 * 1000 - 1);
        expect(cache.has("owner-id", "/media")).toBe(true);
        vi.advanceTimersByTime(1);
        expect(cache.has("owner-id", "/media")).toBe(false);
    });
});
