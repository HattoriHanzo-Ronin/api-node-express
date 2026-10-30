import type { SignOptions } from "jsonwebtoken";

export type JwtExpiresIn = Extract<SignOptions["expiresIn"], string>;

export type JwtProviderDependencies = {
    secret: string;
    expiresIn: SignOptions["expiresIn"];
};
