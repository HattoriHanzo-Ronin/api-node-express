import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";
import UsersSchema from "./users-schema.js";

const { ERROR_MESSAGES } = ValidateUtils;
const { typeRequired, emptyString } = ERROR_MESSAGES;
const { username, password } = UsersSchema.getUsersSchema().shape;
const authLoginSchema = z.object({
    username,
    password
});
const authRefreshTokenSchema = z.object({
    refreshToken: z.string(typeRequired).trim().min(1, emptyString)
});

export { authLoginSchema, authRefreshTokenSchema };
