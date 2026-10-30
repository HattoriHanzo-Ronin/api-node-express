import type { SignOptions } from "jsonwebtoken";

export type JwtProviderDependencies = {
    secret: string;
    expiresIn: SignOptions["expiresIn"];
};
