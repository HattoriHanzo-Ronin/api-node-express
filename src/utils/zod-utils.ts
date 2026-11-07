import z, { output, RefinementCtx, ZodEnum, ZodObject, ZodRawShape } from "zod";
import ApiError from "./error/api-error.js";
import { API_ERROR } from "../config/errors.js";
import type { ValidationIssue, ZodErrorMessages } from "../types/zod-utils.js";
import { $ZodObjectConfig, $ZodStringParams, util } from "zod/v4/core";

/**
 * Zod validation utilities
 *
 * @author HattoriHanzo-Ronin
 */
export default class ZodUtils {
    static readonly ERROR_MESSAGES: ZodErrorMessages = ZodUtils.deepFreeze({
        typeRequired: {
            error: (issue) => (issue.input === undefined ? "Requerido" : "Tipo no válido")
        },
        typeNotRequired: { error: "Tipo no válido" },
        format: "Error de formato",
        length: (num: number, mode: "min" | "max") =>
            `Longitud ${mode === "min" ? "mínima" : "máxima"} ${num} ${num > 1 ? "caracteres" : "caracter"}`,
        invalidEnum: (values) => ({ error: `Valores permitidos: ${values.join(", ")}` }),
        emptyArray: "Debe contener al menos un elemento",
        emptyString: "No puede estar vacío"
    });

    /**
     * Creates a case-insensitive enum schema
     *
     * @param zodEnum Zod enum schema
     * @param errorMessage Validation error message
     * @returns Normalized enum schema
     */
    static zodEnumIgnoreCase<T extends Record<string, string>>(
        zodEnum: ZodEnum<T>,
        errorMessage: $ZodStringParams
    ): z.ZodPipe<z.ZodString, ZodEnum<T>> {
        return z.string(errorMessage).trim().toUpperCase().pipe(zodEnum);
    }

    /**
     * Extends a schema with required properties
     *
     * @param schema Base schema
     * @param properties Required properties
     * @returns Extended schema
     */
    static useRequiredProperties<
        Shape extends ZodRawShape,
        Properties extends ZodRawShape,
        Config extends $ZodObjectConfig
    >(
        schema: ZodObject<Shape, Config>,
        properties: Properties
    ): ZodObject<util.Extend<Shape, util.Writeable<Properties>>, Config> {
        return schema.extend(properties);
    }

    /**
     * Extends a schema with custom validation rules
     *
     * @param schema Base schema
     * @param cases Custom validation callback
     * @returns Extended schema
     */
    static withSuperRefine<T extends z.ZodType>(schema: T, cases: (data: z.infer<T>, ctx: RefinementCtx) => void): T {
        return schema.superRefine((data, ctx) => cases(data, ctx));
    }

    /**
     * Validates data against a schema
     *
     * @param data Data to validate
     * @param schema Validation schema
     * @returns Parsed data
     * @throws {ApiError} When validation is invalid
     */
    static validateData<ZodObj extends ZodObject>(data: unknown, schema: ZodObj): output<ZodObj> {
        const result = schema.safeParse(data);
        if (!result.success) {
            const details = result.error.issues.map((issue) => {
                const { path, code, message: issueMessage } = issue;
                const field = path.join(".");
                const message =
                    code === "invalid_type" && issue.expected === "object"
                        ? "Debe enviar un objeto válido"
                        : issueMessage;
                return field ? { field, message } : { message };
            });
            throw new ApiError({
                message: "Error al validar los datos",
                status: 400,
                details,
                apiError: API_ERROR.validationFailed
            });
        }

        return result.data;
    }

    /**
     * Handles schema validation issues
     *
     * @param issues Validation issues to evaluate
     * @param issues[].condition Indicates whether the issue should be added
     * @param issues[].path Validation issue path
     * @param issues[].message Validation issue message
     * @param issues[].execute Function to execute when condition is met
     * @param ctx Zod validation context
     */
    static handleValidationIssues(issues: ValidationIssue[], ctx: RefinementCtx): void {
        for (const { condition, path, message, execute } of issues) {
            if (condition) {
                if (execute) {
                    execute();
                }

                if (message) {
                    ctx.addIssue({ code: "custom", path, message });
                }
            }
        }
    }

    private static deepFreeze<Type extends object>(object: Type): Readonly<Type> {
        Object.values(object).forEach((value) => {
            if (!value || typeof value !== "object") {
                return;
            }

            if (Array.isArray(value) || Object.getPrototypeOf(value) === Object.prototype) {
                ZodUtils.deepFreeze(value);
            }
        });

        return Object.freeze(object);
    }
}
