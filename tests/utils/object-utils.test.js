import { describe, expect, it } from "vitest";
import ObjectUtils from "../../src/utils/object-utils.js";

describe("ObjectUtils", () => {
    it("should deeply freeze objects", () => {
        const value = { nested: { items: [{ id: 1 }] } };
        const result = ObjectUtils.deepFreeze(value);

        expect(result).toBe(value);
        expect(Object.isFrozen(result)).toBe(true);
        expect(Object.isFrozen(result.nested)).toBe(true);
        expect(Object.isFrozen(result.nested.items)).toBe(true);
        expect(Object.isFrozen(result.nested.items[0])).toBe(true);
    });
});
