import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { API_ERROR } from "../../../config/errors.js";
import ApiError from "../../error/api-error.js";
import type { TokenProvider } from "../token-provider.js";
import type { CreateTokenParams, VerifyTokenParams } from "../../../types/token-provider.js";
import type { JwtProviderDependencies } from "../../../types/jwt-provider.js";

/**
 * JWT token provider for router control panel sessions
 *
 * @author HattoriHanzo-Ronin
 */
export class JwtProvider<Payload extends object> implements TokenProvider<Payload> {
    private readonly secret: string;
    private readonly expiresIn: SignOptions["expiresIn"];

    constructor({ secret, expiresIn }: JwtProviderDependencies) {
        this.secret = secret;
        this.expiresIn = expiresIn;
    }

    create({ payload }: CreateTokenParams<Payload>): string {
        return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
    }

    verify({ token }: VerifyTokenParams): Payload {
        try {
            const payload = jwt.verify(token, this.secret);
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
