import type z from "zod";
import type UsersSchema from "../../schemas/users-schema.js";
import type idSchema from "../../schemas/common/id-schema.js";

export type UserUpdateSchema = z.ZodObject<
    z.core.util.Extend<
        ReturnType<ReturnType<typeof UsersSchema.getBaseSchema>["partial"]>["shape"],
        typeof idSchema.shape
    >
>;
