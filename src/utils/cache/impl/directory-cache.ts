import { ENV } from "../../../config/environment.js";
import type {
    DirectoryCacheEntries,
    DirectoryCacheTimeouts,
    DirectoryHash
} from "../../../types/utils/directory-cache.js";
import type Cache from "../cache.js";

/**
 * Manages cached directory versions for each owner
 *
 * @author HattoriHanzo-Ronin
 */
export default class DirectoryCache implements Cache<DirectoryHash> {
    private static readonly INACTIVITY_TIMEOUT = ENV.directoryCacheInactivityTimeout;

    private cache: DirectoryCacheEntries = new Map();
    private clearTimeouts: DirectoryCacheTimeouts = new Map();

    set(ownerId: string, key: string, value: DirectoryHash) {
        let entry = this.cache.get(ownerId);
        if (!entry) {
            entry = new Map();
            this.cache.set(ownerId, entry);
        }

        entry.set(key, value);
        this.clear(ownerId, key);
    }

    get(ownerId: string, key: string) {
        if (!this.has(ownerId, key)) {
            return undefined;
        }

        return this.cache.get(ownerId)?.get(key);
    }

    has(ownerId: string, key: string) {
        return this.cache.get(ownerId)?.has(key) === true;
    }

    delete(ownerId: string, key: string) {
        if (!this.has(ownerId, key)) {
            return;
        }

        const entry = this.cache.get(ownerId);
        if (!entry) {
            return;
        }

        entry.delete(key);
        if (!entry.size) {
            this.cache.delete(ownerId);
        }

        const clearTimeouts = this.clearTimeouts.get(ownerId);
        if (!clearTimeouts) {
            return;
        }

        clearTimeout(clearTimeouts.get(key));
        clearTimeouts.delete(key);
        if (!clearTimeouts.size) {
            this.clearTimeouts.delete(ownerId);
        }
    }

    private clear(ownerId: string, key: string): void {
        let clearTimeouts = this.clearTimeouts.get(ownerId);
        if (!clearTimeouts) {
            clearTimeouts = new Map();
            this.clearTimeouts.set(ownerId, clearTimeouts);
        }

        const previousTimeout = clearTimeouts.get(key);
        if (previousTimeout) {
            clearTimeout(previousTimeout);
        }

        const timeout = setTimeout(() => this.delete(ownerId, key), DirectoryCache.INACTIVITY_TIMEOUT);
        clearTimeouts.set(key, timeout);
    }
}
