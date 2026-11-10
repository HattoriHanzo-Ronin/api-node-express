import jwt from "jsonwebtoken";
import { API_ERROR } from "../../../config/errors.js";
import ApiError from "../../error/api-error.js";
import type TokenProvider from "../token-provider.js";
import type { CreateTokenParams, VerifyTokenParams } from "../../../types/utils/token-provider.js";
import type { JwtProviderDependencies } from "../../../types/utils/jwt-provider.js";

/**
 * JWT token provider for router control panel sessions
 *
 * @author HattoriHanzo-Ronin
 */
export default class JwtProvider<Payload extends object> implements TokenProvider<Payload> {
    constructor(private readonly dependencies: JwtProviderDependencies) {}

    create({ payload }: CreateTokenParams<Payload>) {
        return jwt.sign(payload, this.dependencies.secret, { expiresIn: this.dependencies.expiresIn });
    }

    verify({ token }: VerifyTokenParams) {
        try {
            const payload = jwt.verify(token, this.dependencies.secret);
            if (typeof payload === "string") {
                throw new ApiError({
                    message: "Sesión no válida",
                    status: 401,
                    apiError: API_ERROR.routerSessionInvalid
                });
            }

            return payload as Payload;
        } catch (err) {
            ApiError.handle([
                {
                    condition: err instanceof jwt.JsonWebTokenError,
                    message: "Sesión no válida",
                    status: 401,
                    apiError: API_ERROR.routerSessionInvalid
                }
            ]);

            throw err;
        }
    }
}
