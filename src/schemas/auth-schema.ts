import z from "zod";
import ZodUtils from "../utils/zod-utils.js";
import UsersSchema from "./users-schema.js";

const {
    ERROR_MESSAGES: { typeRequired, emptyString }
} = ZodUtils;
const { username, password } = UsersSchema.getBaseSchema().shape;
const AUTH_LOGIN_SCHEMA = z.object({ username, password });
const AUTH_REFRESH_TOKEN_SCHEMA = z.object({ refreshToken: z.string(typeRequired).trim().min(1, emptyString) });

export { AUTH_LOGIN_SCHEMA, AUTH_REFRESH_TOKEN_SCHEMA };
