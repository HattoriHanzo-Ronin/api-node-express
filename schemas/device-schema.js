import z from "zod";
import ValidateUtils from "../utils/validate-utils.js";

/**
 * Device validation schemas
 *
 * @author HattoriHanzo-Ronin
 */
export default class DeviceSchema {
    static getDeviceSchema() {
        return withSuperRefine(deviceSchema);
    }

    static getPartialDeviceSchema() {
        return withSuperRefine(deviceSchema.partial());
    }

    static getDeviceSchemaWithId() {
        return withSuperRefine(deviceSchemaWithId);
    }

    static getPartialDeviceSchemaWithId() {
        return withSuperRefine(deviceSchemaWithId.partial());
    }
}

const { ERROR_MESSAGES, REGEX, ALLOW_ENUMS, handleValidationIssues, zodEnumIgnoreCase } = ValidateUtils;
const {
    typeRequired,
    typeNotRequired,
    format,
    length,
    requiredEnum,
    badDeviceIntrface,
    badDeviceType,
    invalidId,
    invalidEnum
} = ERROR_MESSAGES;
const { passwordRegex, macRegex, ipRegex, safeTextRegex } = REGEX;
const { deviceIntrface, deviceType } = ALLOW_ENUMS;
const deviceSchema = z.object({
    name: z
        .string(typeRequired)
        .trim()
        .min(4, length(4, "min"))
        .max(30, length(30, "max"))
        .regex(safeTextRegex, format),
    mac: z.string(typeRequired).trim().regex(macRegex, format),
    intrface: zodEnumIgnoreCase(z, z.enum(deviceIntrface, requiredEnum(invalidEnum("interfaz", deviceIntrface)))),
    type: zodEnumIgnoreCase(z, z.enum(deviceType, requiredEnum(invalidEnum("tipo de dispositivo", deviceType)))),
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
const deviceSchemaWithId = deviceSchema.extend({
    id: z.string(typeRequired).uuid(invalidId)
});

function withSuperRefine(schema) {
    return schema.superRefine((data, ctx) => {
        const isRouter = data.type === "ROUTER";
        handleValidationIssues(
            [
                {
                    condition: isRouter,
                    execute: () =>
                        handleValidationIssues(
                            [
                                {
                                    condition: data.mac_filter === null,
                                    path: ["mac_filter"],
                                    message: "Debe especificar si el router soporta filtrado MAC"
                                },
                                {
                                    condition: data.admin_pass === null,
                                    path: ["admin_pass"],
                                    message: "Debe especificar contraseña de acceso al router"
                                },
                                {
                                    condition: data.ip === null,
                                    path: ["ip"],
                                    message: "Debe especificar ip del router"
                                }
                            ],
                            ctx
                        )
                },
                {
                    condition: !isRouter,
                    execute: () =>
                        handleValidationIssues(
                            [
                                {
                                    condition: data.mac_filter !== null,
                                    path: ["mac_filter"],
                                    message: "Solo el router soporta filtrado MAC"
                                },
                                {
                                    condition: data.admin_pass !== null,
                                    path: ["admin_pass"],
                                    message: "Solo el router soporta contraseña de acceso"
                                },
                                {
                                    condition: data.wifi_pass !== null,
                                    path: ["wifi_pass"],
                                    message: "Solo el router soporta contraseña Wi-Fi"
                                }
                            ],
                            ctx
                        )
                },
                {
                    condition: data.type === "SERVER" && data.ip === null,
                    path: ["ip"],
                    message: "Debe especificar ip del servidor"
                }
            ],
            ctx
        );
    });
}
