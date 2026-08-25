import z from "zod";
import { USER_ROLE, VALIDATION } from "../config/constants.js";
import ValidateUtils from "../utils/validate-utils.js";
import idSchema from "./common/id-schema.js";

/**
 * Users validation schemas
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersSchema {
    static getBaseSchema() {
        return usersSchema;
    }

    static getValidatedSchema() {
        return withSuperRefine(usersSchema, cases);
    }

    static getPartialSchema() {
        const updateSchema = useRequiredProperties(usersSchema.partial(), idSchema.shape);
        return withSuperRefine(updateSchema, cases);
    }

    static getChangePasswordSchema() {
        return z.object({ currentPassword: passwordSchema, newPassword: passwordSchema });
    }
}

const {
    zodEnumIgnoreCase,
    useRequiredProperties,
    withSuperRefine,
    handleValidationIssues
} = ValidateUtils;
const { errorMessages, regex, allowEnums } = VALIDATION;
const { typeRequired, format, emptyArray, length, invalidEnum } = errorMessages;
const { passwordRegex } = regex;
const { userRoles } = allowEnums;
const { admin } = USER_ROLE;
const rolesArraySchema = z
    .array(zodEnumIgnoreCase(z, z.enum(userRoles, invalidEnum(userRoles)), typeRequired), typeRequired)
    .min(1, emptyArray)
    .optional();
const passwordSchema = z
    .string(typeRequired)
    .trim()
    .min(12, length(12, "min"))
    .max(128, length(128, "max"))
    .regex(passwordRegex, format);
const usersSchema = z.object({
    username: z
        .string(typeRequired)
        .trim()
        .min(3, length(3, "min"))
        .max(30, length(30, "max"))
        .regex(/^[a-z0-9_-]+$/, format),
    password: passwordSchema,
    roles: rolesArraySchema,
    scope: rolesArraySchema,
    active: z.boolean(typeRequired)
});

function cases({ roles, scope }, ctx) {
    return handleValidationIssues(
        [
            {
                condition: roles,
                execute: () => {
                    handleValidationIssues(
                        [
                            {
                                condition: !roles.includes(admin) && scope !== undefined,
                                path: ["scope"],
                                message: "No se puede definir scope para un usuario que no sea administrador"
                            },
                            {
                                condition: roles.includes(admin) && scope === undefined,
                                path: ["scope"],
                                message: "Se debe definir scope para un usuario administrador"
                            }
                        ],
                        ctx
                    );
                }
            }
        ],
        ctx
    );
}
