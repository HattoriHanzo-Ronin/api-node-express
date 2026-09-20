import { CACHE } from "../config/constants.js";

/**
 * Manages a size-limited two-level memory cache
 *
 * @author HattoriHanzo-Ronin
 */
export default class MemoryCache {
    #cache = new Map();
    #clearTimeouts = new Map();
    #size = 0;

    /**
     * Inserts a value into the cache
     *
     * @param {string} ownerId Cache owner identifier
     * @param {string} key Cache entry key
     * @param {Map<string, Buffer | null>} value Cached value
     */
    set(ownerId, key, value) {
        let entry = this.#cache.get(ownerId);
        if (!entry) {
            entry = { size: 0, values: new Map() };
            this.#cache.set(ownerId, entry);
        }

        this.#refreshOwner(ownerId, entry);

        if (this.has(ownerId, key)) {
            const previousSize = getValueSize(entry.values.get(key));
            entry.size -= previousSize;
            this.#size -= previousSize;
            entry.values.delete(key);
        }

        entry.values.set(key, value);
        const size = getValueSize(value);
        entry.size += size;
        this.#size += size;
        this.#enforceLimits(ownerId);
        this.#clear(ownerId);
    }

    /**
     * Returns a cached value
     *
     * @param {string} ownerId Cache owner identifier
     * @param {string} key Cache entry key
     * @returns {Map<string, Buffer | null> | undefined} Cached value
     */
    get(ownerId, key) {
        if (!this.has(ownerId, key)) {
            return undefined;
        }

        const entry = this.#cache.get(ownerId);
        this.#refreshOwner(ownerId, entry);
        const value = entry.values.get(key);
        if (entry.values.size > 1) {
            entry.values.delete(key);
            entry.values.set(key, value);
        }

        this.#clear(ownerId);
        return value;
    }

    /**
     * Returns whether a cached value exists
     *
     * @param {string} ownerId Cache owner identifier
     * @param {string} key Cache entry key
     * @returns {boolean} Whether the cached value exists
     */
    has(ownerId, key) {
        return this.#cache.get(ownerId)?.values.has(key) === true;
    }

    /**
     * Deletes a cached value
     *
     * @param {string} ownerId Cache owner identifier
     * @param {string} key Cache entry key
     */
    delete(ownerId, key) {
        if (!this.has(ownerId, key)) {
            return;
        }

        const entry = this.#cache.get(ownerId);
        const value = entry.values.get(key);
        const size = getValueSize(value);
        entry.size -= size;
        this.#size -= size;
        entry.values.delete(key);
        if (!entry.values.size) {
            this.#deleteOwner(ownerId);
        }
    }

    #refreshOwner(ownerId, entry) {
        if (this.#cache.size > 1) {
            this.#cache.delete(ownerId);
            this.#cache.set(ownerId, entry);
        }
    }

    #deleteOwner(ownerId) {
        const entry = this.#cache.get(ownerId);
        if (!entry) {
            return;
        }

        this.#size -= entry.size;
        this.#cache.delete(ownerId);
        const timeout = this.#clearTimeouts.get(ownerId);
        if (timeout) {
            clearTimeout(timeout);
            this.#clearTimeouts.delete(ownerId);
        }
    }

    #enforceLimits(ownerId) {
        const entry = this.#cache.get(ownerId);
        if (entry?.size > maxSizePerUser) {
            this.delete(ownerId, entry.values.keys().next().value);
        }

        while (this.#size > maxSize) {
            const oldestMultiple = [...this.#cache].find(([, it]) => it.values.size > 1);
            if (oldestMultiple) {
                const [oldestOwnerId, oldestEntry] = oldestMultiple;
                this.delete(oldestOwnerId, oldestEntry.values.keys().next().value);
            } else {
                this.#deleteOwner(this.#cache.keys().next().value);
            }
        }
    }

    #clear(ownerId) {
        const previousTimeout = this.#clearTimeouts.get(ownerId);
        if (previousTimeout) {
            clearTimeout(previousTimeout);
        }

        const timeout = setTimeout(() => this.#deleteOwner(ownerId), inactivityTimeout);
        this.#clearTimeouts.set(ownerId, timeout);
    }
}

const { maxSize, maxSizePerUser, inactivityTimeout } = CACHE;

function getValueSize(value) {
    let size = 0;
    for (const buffer of value.values()) {
        size += buffer?.length ?? 0;
    }
    return size;
}
