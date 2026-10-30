import type { CreateTokenParams, VerifyTokenParams } from "../../types/token-provider.js";

/**
 * Token provider contract
 *
 * @author HattoriHanzo-Ronin
 */
export interface TokenProvider<Payload extends object> {
    /**
     * Creates a signed token
     *
     * @param params.payload Token payload
     * @returns Signed token
     */
    create(params: CreateTokenParams<Payload>): string;

    /**
     * Verifies and decodes a token
     *
     * @param params.token Signed token
     * @returns Decoded token payload
     * @throws {ApiError} When the token is invalid
     */
    verify(params: VerifyTokenParams): Payload;
}
