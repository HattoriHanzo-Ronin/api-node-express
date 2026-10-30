import { describe, expect, it, vi } from "vitest";
import ApiError from "../../../src/utils/error/api-error.js";
import { API_ERROR } from "../../../src/config/errors.js";

describe("ApiError", () => {
    it("should throw an ApiError for a matching condition", () => {
        expect(() =>
            ApiError.handle([
                {
                    condition: true,
                    message: "Valor no válido",
                    status: 400,
                    apiError: API_ERROR.routerSessionInvalid
                }
            ])
        ).toThrow(expect.objectContaining({ code: "ROUTER_SESSION_INVALID", status: 400 }));
    });

    it("should execute matching actions without throwing when no message is supplied", () => {
        const execute = vi.fn();
        ApiError.handle([{ condition: true, execute }]);
        expect(execute).toHaveBeenCalledWith();
    });
});
