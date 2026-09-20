import { CACHE } from "../config/constants.js";

/**
 * Manages the last directory version cached for each owner
 *
 * @author HattoriHanzo-Ronin
 */
export default class DirectoryCache {
    #cache = new Map();
    #clearTimeouts = new Map();

    /**
     * Caches a directory version
     *
     * @param {string} ownerId Cache owner identifier
     * @param {string} key Directory path
     * @param {{ username: string, hash: string }} value Directory version
     */
    set(ownerId, key, value) {
        let entry = this.#cache.get(ownerId);
        if (!entry) {
            entry = new Map();
            this.#cache.set(ownerId, entry);
        }

        entry.set(key, value);
        this.#clear(ownerId, key);
    }

    /**
     * Returns a cached directory hash
     *
     * @param {string} ownerId Cache owner identifier
     * @param {string} key Directory path
     * @returns {{ username: string, hash: string } | undefined} Cached directory version
     */
    get(ownerId, key) {
        if (!this.has(ownerId, key)) {
            return undefined;
        }

        return this.#cache.get(ownerId).get(key);
    }

    /**
     * Returns whether a directory hash is cached
     *
     * @param {string} ownerId Cache owner identifier
     * @param {string} key Directory path
     * @returns {boolean} Whether the directory hash exists
     */
    has(ownerId, key) {
        return this.#cache.get(ownerId)?.has(key) === true;
    }

    /**
     * Deletes a cached directory hash
     *
     * @param {string} ownerId Cache owner identifier
     * @param {string} key Directory path
     */
    delete(ownerId, key) {
        if (!this.has(ownerId, key)) {
            return;
        }

        const entry = this.#cache.get(ownerId);
        entry.delete(key);
        if (!entry.size) {
            this.#cache.delete(ownerId);
        }

        const clearTimeouts = this.#clearTimeouts.get(ownerId);
        clearTimeout(clearTimeouts.get(key));
        clearTimeouts.delete(key);
        if (!clearTimeouts.size) {
            this.#clearTimeouts.delete(ownerId);
        }
    }

    #clear(ownerId, key) {
        let clearTimeouts = this.#clearTimeouts.get(ownerId);
        if (!clearTimeouts) {
            clearTimeouts = new Map();
            this.#clearTimeouts.set(ownerId, clearTimeouts);
        }

        const previousTimeout = clearTimeouts.get(key);
        if (previousTimeout) {
            clearTimeout(previousTimeout);
        }

        const timeout = setTimeout(() => this.delete(ownerId, key), inactivityTimeout);
        clearTimeouts.set(key, timeout);
    }
}

const { inactivityTimeout } = CACHE;
