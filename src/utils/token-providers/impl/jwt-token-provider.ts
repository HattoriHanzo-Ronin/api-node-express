import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
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
export default class JwtProvider<
    Payload extends object,
    VerifiedPayload extends Payload = Payload
> implements TokenProvider<Payload, VerifiedPayload> {
    private readonly secret: string;
    private readonly expiresIn: SignOptions["expiresIn"];

    constructor({ secret, expiresIn }: JwtProviderDependencies) {
        this.secret = secret;
        this.expiresIn = expiresIn;
    }

    create({ payload }: CreateTokenParams<Payload>) {
        return jwt.sign(payload, this.secret, { expiresIn: this.expiresIn });
    }

    verify({ token }: VerifyTokenParams) {
        try {
            const payload = jwt.verify(token, this.secret);
            return payload as VerifiedPayload;
        } catch (err) {
            ApiError.handle([
                {
                    condition: err instanceof jwt.JsonWebTokenError,
                    message: "Token no válido",
                    status: 401,
                    apiError: API_ERROR.invalidToken,
                    cause: err
                }
            ]);

            throw err;
        }
    }
}
