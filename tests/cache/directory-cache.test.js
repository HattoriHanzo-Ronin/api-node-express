import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CACHE } from "../../src/config/constants.js";
import DirectoryCache from "../../src/cache/directory-cache.js";

describe("DirectoryCache", () => {
    let cache;

    beforeEach(() => {
        vi.useFakeTimers();
        cache = new DirectoryCache();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("should set, get and delete directory versions", () => {
        const value = { username: "ronin", hash: "first-hash" };
        cache.set("user-id", "/first", value);
        expect(cache.has("user-id", "/first")).toBe(true);
        expect(cache.get("user-id", "/first")).toBe(value);
        cache.delete("user-id", "/first");
        expect(cache.has("user-id", "/first")).toBe(false);
        expect(cache.get("user-id", "/first")).toBeUndefined();
    });

    it("should cache multiple directories for the same owner", () => {
        const first = { username: "ronin", hash: "first-hash" };
        const second = { username: "ronin", hash: "second-hash" };
        cache.set("user-id", "/first", first);
        cache.set("user-id", "/second", second);
        expect(cache.get("user-id", "/first")).toBe(first);
        expect(cache.get("user-id", "/second")).toBe(second);
        cache.delete("user-id", "/first");
        expect(cache.has("user-id", "/first")).toBe(false);
        expect(cache.get("user-id", "/second")).toBe(second);
    });

    it("should restart the inactivity timeout on set", () => {
        const value = { username: "ronin", hash: "first-hash" };
        cache.set("user-id", "/files", value);
        vi.advanceTimersByTime(9 * 60 * 1000);
        cache.set("user-id", "/files", { ...value, hash: "second-hash" });
        vi.advanceTimersByTime(9 * 60 * 1000);
        expect(cache.has("user-id", "/files")).toBe(true);
        vi.advanceTimersByTime(CACHE.inactivityTimeout - 9 * 60 * 1000);
        expect(cache.has("user-id", "/files")).toBe(false);
    });

    it("should not restart the inactivity timeout on get", () => {
        const value = { username: "ronin", hash: "hash" };
        cache.set("user-id", "/files", value);
        vi.advanceTimersByTime(9 * 60 * 1000);
        expect(cache.get("user-id", "/files")).toBe(value);
        vi.advanceTimersByTime(60 * 1000);
        expect(cache.has("user-id", "/files")).toBe(false);
    });

    it("should expire each directory independently", () => {
        const value = { username: "ronin", hash: "hash" };
        cache.set("user-id", "/first", value);
        vi.advanceTimersByTime(9 * 60 * 1000);
        cache.set("user-id", "/second", value);
        vi.advanceTimersByTime(60 * 1000);
        expect(cache.has("user-id", "/first")).toBe(false);
        expect(cache.has("user-id", "/second")).toBe(true);
        vi.advanceTimersByTime(9 * 60 * 1000);
        expect(cache.has("user-id", "/second")).toBe(false);
    });
});
