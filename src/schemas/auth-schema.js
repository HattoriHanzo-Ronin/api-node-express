import z from "zod";
import ZodUtils from "../utils/zod-utils.js";
import UsersSchema from "./users-schema.js";

const {
    ERROR_MESSAGES: { typeRequired, emptyString }
} = ZodUtils;
const { username, password } = UsersSchema.getBaseSchema().shape;
const authLoginSchema = z.object({ username, password });
const authRefreshTokenSchema = z.object({ refreshToken: z.string(typeRequired).trim().min(1, emptyString) });

export { authLoginSchema, authRefreshTokenSchema };
