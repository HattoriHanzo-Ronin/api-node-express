import type { SignOptions } from "jsonwebtoken";

export type JwtExpiresIn = Extract<SignOptions["expiresIn"], string>;

/**
 * JWT token provider dependencies
 *
 * @author HattoriHanzo-Ronin
 */
export type JwtProviderDependencies = {
    secret: string;
    expiresIn: SignOptions["expiresIn"];
};
