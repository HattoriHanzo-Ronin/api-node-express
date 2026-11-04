/**
 * Defines the contract for an owner-based cache
 *
 * @author HattoriHanzo-Ronin
 */
export default interface Cache<T> {
    /**
     * Inserts or updates a cached value
     *
     * @param ownerId Cache owner identifier
     * @param key Cache entry key
     * @param value Value to cache
     */
    set(ownerId: string, key: string, value: T): void;

    /**
     * Returns a cached value
     *
     * @param ownerId Cache owner identifier
     * @param key Cache entry key
     * @returns Cached value or undefined if not found
     */
    get(ownerId: string, key: string): T | undefined;

    /**
     * Checks whether a cached value exists
     *
     * @param ownerId Cache owner identifier
     * @param key Cache entry key
     * @returns Whether the cached value exists
     */
    has(ownerId: string, key: string): boolean;

    /**
     * Removes a cached value
     *
     * @param ownerId Cache owner identifier
     * @param key Cache entry key
     */
    delete(ownerId: string, key: string): void;
}