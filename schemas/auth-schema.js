import z from "zod";
import { VALIDATION } from "../config/constants.js";
import UsersSchema from "./users-schema.js";

const { errorMessages } = VALIDATION;
const { typeRequired, emptyString } = errorMessages;
const { username, password } = UsersSchema.getBaseSchema().shape;
const authLoginSchema = z.object({ username, password });
const authRefreshTokenSchema = z.object({ refreshToken: z.string(typeRequired).trim().min(1, emptyString) });

export { authLoginSchema, authRefreshTokenSchema };
