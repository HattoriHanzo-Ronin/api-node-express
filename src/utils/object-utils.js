/**
 * Object utility helpers
 *
 * @author HattoriHanzo-Ronin
 */
export default class ObjectUtils {
    /**
     * Recursively freezes an object, including nested arrays and plain objects
     *
     * @template T
     * @param {T} object Object to freeze
     * @returns {Readonly<T>} Frozen object
     */
    static deepFreeze(object) {
        Object.values(object).forEach((value) => {
            if (value && (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype)) {
                ObjectUtils.deepFreeze(value);
            }
        });

        return Object.freeze(object);
    }
}
