import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";
import idSchema from "./id-schema.js";

/**
 * Devices validation schemas
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesSchema {
    static getBaseSchema() {
        return devicesSchema;
    }

    static getValidatedSchema() {
        return withSuperRefine(devicesSchema, cases);
    }

    static getPartialSchema() {
        const updateSchema = useRequiredProperties(devicesSchema.partial(), idSchema.shape);
        return withSuperRefine(updateSchema, cases);
    }
}

const {
    ERROR_MESSAGES,
    REGEX,
    ALLOW_ENUMS,
    handleValidationIssues,
    zodEnumIgnoreCase,
    useRequiredProperties,
    withSuperRefine
} = ValidateUtils;
const { typeRequired, typeNotRequired, format, length, invalidEnum } = ERROR_MESSAGES;
const { passwordRegex, macRegex, ipRegex, safeTextRegex } = REGEX;
const { devicesIntrface, devicesType } = ALLOW_ENUMS;
const devicesSchema = z.object({
    name: z
        .string(typeRequired)
        .trim()
        .min(4, length(4, "min"))
        .max(30, length(30, "max"))
        .regex(safeTextRegex, format),
    mac: z.string(typeRequired).trim().regex(macRegex, format),
    intrface: zodEnumIgnoreCase(z, z.enum(devicesIntrface, invalidEnum(devicesIntrface)), typeRequired),
    type: zodEnumIgnoreCase(z, z.enum(devicesType, invalidEnum(devicesType)), typeRequired),
    model: z
        .string(typeNotRequired)
        .trim()
        .min(8, length(8, "min"))
        .max(60, length(60, "max"))
        .regex(safeTextRegex, format)
        .nullable()
        .default(null),
    ip: z.string(typeNotRequired).trim().regex(ipRegex, format).nullable().default(null),
    wifi_pass: z
        .string(typeNotRequired)
        .trim()
        .min(8, length(8, "min"))
        .max(63, length(63, "max"))
        .regex(passwordRegex, format)
        .nullable()
        .default(null),
    admin_pass: z
        .string(typeNotRequired)
        .trim()
        .min(8, length(8, "min"))
        .max(128, length(128, "max"))
        .regex(passwordRegex, format)
        .nullable()
        .default(null),
    mac_filter: z.boolean(typeNotRequired).nullable().default(null)
});

function cases({ type, mac_filter, admin_pass, ip, wifi_pass, model }, ctx) {
    const isRouter = type === "ROUTER";
    handleValidationIssues(
        [
            {
                condition: isRouter,
                execute: () => {
                    handleValidationIssues(
                        [
                            {
                                condition: mac_filter === null,
                                path: ["mac_filter"],
                                message: "Debe especificar si el router soporta filtrado MAC"
                            },
                            {
                                condition: mac_filter && model === null,
                                path: ["model"],
                                message: "Debe especificar el modelo del router para gestionar el filtrado MAC"
                            },
                            {
                                condition: admin_pass === null,
                                path: ["admin_pass"],
                                message: "Debe especificar contraseña de acceso al router"
                            },
                            {
                                condition: ip === null,
                                path: ["ip"],
                                message: "Debe especificar ip del router"
                            }
                        ],
                        ctx
                    );
                }
            },
            {
                condition: !isRouter,
                execute: () => {
                    handleValidationIssues(
                        [
                            {
                                condition: mac_filter !== null,
                                path: ["mac_filter"],
                                message: "Solo el router soporta filtrado MAC"
                            },
                            {
                                condition: admin_pass !== null,
                                path: ["admin_pass"],
                                message: "Solo el router soporta contraseña de acceso"
                            },
                            {
                                condition: wifi_pass !== null,
                                path: ["wifi_pass"],
                                message: "Solo el router soporta contraseña Wi-Fi"
                            }
                        ],
                        ctx
                    );
                }
            },
            {
                condition: type === "SERVER" && ip === null,
                path: ["ip"],
                message: "Debe especificar ip del servidor"
            }
        ],
        ctx
    );
}
