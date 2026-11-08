import { ENV } from "../../../config/environment.js";
import type { MemoryCacheEntries, MemoryCacheEntry, MemoryCacheMap, MemoryCacheTimeouts } from "../../../types/utils/memory-cache.js";
import type Cache from "../cache.js";

const { memoryCacheMaxSize, memoryCacheMaxSizePerOwner, memoryCacheInactivityTimeout } = ENV;

/**
 * Manages a size-limited two-level memory cache
 *
 * @author HattoriHanzo-Ronin
 */
export default class MemoryCache implements Cache<MemoryCacheMap> {
    private static readonly MAX_SIZE = memoryCacheMaxSize;
    private static readonly MAX_SIZE_PER_OWNER = memoryCacheMaxSizePerOwner;
    private static readonly INACTIVITY_TIMEOUT = memoryCacheInactivityTimeout;

    private cache: MemoryCacheEntries = new Map();
    private clearTimeouts: MemoryCacheTimeouts = new Map();
    private size = 0;

    set(ownerId: string, key: string, value: MemoryCacheMap) {
        let entry = this.cache.get(ownerId);
        if (!entry) {
            entry = { size: 0, values: new Map() };
            this.cache.set(ownerId, entry);
        }

        this.refreshOwner(ownerId, entry);

        if (this.has(ownerId, key)) {
            const previousSize = this.getValueSize(entry.values.get(key));
            entry.size -= previousSize;
            this.size -= previousSize;
            entry.values.delete(key);
        }

        entry.values.set(key, value);
        const size = this.getValueSize(value);
        entry.size += size;
        this.size += size;
        this.enforceLimits(ownerId);
        this.clear(ownerId);
    }

    get(ownerId: string, key: string) {
        if (!this.has(ownerId, key)) {
            return undefined;
        }

        const entry = this.cache.get(ownerId);
        if (!entry) {
            return undefined;
        }

        this.refreshOwner(ownerId, entry);
        const value = entry.values.get(key);
        if (!value) {
            return undefined;
        }

        if (entry.values.size > 1) {
            entry.values.delete(key);
            entry.values.set(key, value);
        }

        this.clear(ownerId);
        return value;
    }

    has(ownerId: string, key: string) {
        return this.cache.get(ownerId)?.values.has(key) === true;
    }

    delete(ownerId: string, key: string) {
        if (!this.has(ownerId, key)) {
            return;
        }

        const entry = this.cache.get(ownerId);
        if (!entry) {
            return;
        }

        const value = entry.values.get(key);
        const size = this.getValueSize(value);
        entry.size -= size;
        this.size -= size;
        entry.values.delete(key);
        if (!entry.values.size) {
            this.deleteOwner(ownerId);
        }
    }

    private refreshOwner(ownerId: string, entry: MemoryCacheEntry): void {
        if (this.cache.size > 1) {
            this.cache.delete(ownerId);
            this.cache.set(ownerId, entry);
        }
    }

    private deleteOwner(ownerId: string): void {
        const entry = this.cache.get(ownerId);
        if (!entry) {
            return;
        }

        this.size -= entry.size;
        this.cache.delete(ownerId);
        const timeout = this.clearTimeouts.get(ownerId);
        if (timeout) {
            clearTimeout(timeout);
            this.clearTimeouts.delete(ownerId);
        }
    }

    private enforceLimits(ownerId: string): void {
        const entry = this.cache.get(ownerId);
        if (entry && entry.size > MemoryCache.MAX_SIZE_PER_OWNER) {
            const key = entry.values.keys().next().value;
            if (key !== undefined) {
                this.delete(ownerId, key);
            }
        }

        while (this.size > MemoryCache.MAX_SIZE) {
            const oldestMultiple = [...this.cache].find(([, entry]) => entry.values.size > 1);
            if (oldestMultiple) {
                const [oldestOwnerId, oldestEntry] = oldestMultiple;
                const key = oldestEntry.values.keys().next().value;
                if (key !== undefined) {
                    this.delete(oldestOwnerId, key);
                }
            } else {
                const oldestOwnerId = this.cache.keys().next().value;
                if (oldestOwnerId !== undefined) {
                    this.deleteOwner(oldestOwnerId);
                }
            }
        }
    }

    private clear(ownerId: string): void {
        const previousTimeout = this.clearTimeouts.get(ownerId);
        if (previousTimeout) {
            clearTimeout(previousTimeout);
        }

        const timeout = setTimeout(() => this.deleteOwner(ownerId), MemoryCache.INACTIVITY_TIMEOUT);
        this.clearTimeouts.set(ownerId, timeout);
    }

    private getValueSize(value: MemoryCacheMap | undefined): number {
        if (!value) {
            return 0;
        }

        let size = 0;
        for (const buffer of value.values()) {
            size += buffer?.length ?? 0;
        }
        return size;
    }
}
