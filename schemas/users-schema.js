import z from "zod";
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
}

const {
    ERROR_MESSAGES,
    REGEX,
    ALLOW_ENUMS,
    zodEnumIgnoreCase,
    useRequiredProperties,
    withSuperRefine,
    handleValidationIssues
} = ValidateUtils;
const { typeRequired, format, emptyArray, length, invalidEnum } = ERROR_MESSAGES;
const { passwordRegex } = REGEX;
const { userRoles } = ALLOW_ENUMS;
const rolesArraySchema = z
    .array(zodEnumIgnoreCase(z, z.enum(userRoles, invalidEnum(userRoles)), typeRequired), typeRequired)
    .min(1, emptyArray)
    .optional();
const usersSchema = z.object({
    username: z
        .string(typeRequired)
        .trim()
        .min(3, length(3, "min"))
        .max(30, length(30, "max"))
        .regex(/^[a-z0-9_-]+$/, format),
    password: z
        .string(typeRequired)
        .trim()
        .min(12, length(12, "min"))
        .max(128, length(128, "max"))
        .regex(passwordRegex, format),
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
                                condition: !roles.includes("ADMIN") && scope !== undefined,
                                path: ["scope"],
                                message: "No se puede definir scope para un usuario que no sea administrador"
                            },
                            {
                                condition: roles.includes("ADMIN") && scope === undefined,
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
