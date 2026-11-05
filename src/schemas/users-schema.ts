import z, { type RefinementCtx } from "zod";
import type { CreateUser, UpdateUser } from "../types/users-facade.js";
import type { UserUpdateSchema } from "../types/users-schema.js";
import { USER_ROLE } from "../config/constants.js";
import ValidateUtils from "../utils/validate-utils.js";
import ZodUtils from "../utils/zod-utils.js";
import idSchema from "./common/id-schema.js";

const {
    ERROR_MESSAGES: { typeRequired, format, emptyArray, length, invalidEnum }
} = ZodUtils;

/**
 * Users validation schemas
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersSchema {
    private static readonly USER_ROLES = Object.values(USER_ROLE);

    private static readonly ROLES_ARRAY_SCHEMA = z
        .array(
            ZodUtils.zodEnumIgnoreCase(
                z.enum(UsersSchema.USER_ROLES, invalidEnum(UsersSchema.USER_ROLES)),
                typeRequired
            ),
            typeRequired
        )
        .min(1, emptyArray)
        .optional();
    private static readonly PASSWORD_SCHEMA = z
        .string(typeRequired)
        .trim()
        .min(12, length(12, "min"))
        .max(128, length(128, "max"))
        .regex(ValidateUtils.REGEX.passwordRegex, format);
    private static readonly USERS_SCHEMA = z.object({
        username: z
            .string(typeRequired)
            .trim()
            .min(3, length(3, "min"))
            .max(30, length(30, "max"))
            .regex(/^[a-z0-9_-]+$/, format),
        password: UsersSchema.PASSWORD_SCHEMA,
        roles: UsersSchema.ROLES_ARRAY_SCHEMA,
        scope: UsersSchema.ROLES_ARRAY_SCHEMA,
        active: z.boolean(typeRequired)
    });

    /**
     * Returns the base user schema
     *
     * @returns Base user schema
     */
    static getBaseSchema(): typeof UsersSchema.USERS_SCHEMA {
        return UsersSchema.USERS_SCHEMA;
    }

    /**
     * Returns the validated user schema
     *
     * @returns Validated user schema
     */
    static getValidatedSchema(): typeof UsersSchema.USERS_SCHEMA {
        return ZodUtils.withSuperRefine(UsersSchema.USERS_SCHEMA, UsersSchema.cases);
    }

    /**
     * Returns the user update schema
     *
     * @returns User update schema
     */
    static getPartialSchema(): UserUpdateSchema {
        const updateSchema = ZodUtils.useRequiredProperties(UsersSchema.USERS_SCHEMA.partial(), idSchema.shape);
        return ZodUtils.withSuperRefine(updateSchema, UsersSchema.cases);
    }

    /**
     * Returns the password change schema
     *
     * @returns Password change schema
     */
    static getChangePasswordSchema(): z.ZodObject<{
        currentPassword: typeof UsersSchema.PASSWORD_SCHEMA;
        newPassword: typeof UsersSchema.PASSWORD_SCHEMA;
    }> {
        return z.object({
            currentPassword: UsersSchema.PASSWORD_SCHEMA,
            newPassword: UsersSchema.PASSWORD_SCHEMA
        });
    }

    private static cases({ roles, scope }: CreateUser | UpdateUser, ctx: RefinementCtx): void {
        if (!roles) {
            return;
        }

        const { admin } = USER_ROLE;
        ZodUtils.handleValidationIssues(
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
