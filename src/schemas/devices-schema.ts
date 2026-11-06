import z, { type RefinementCtx } from "zod";
import type { DeviceSchemaData } from "../types/devices-schema.js";
import { CONNECTION_TYPE, DEVICE_TYPE } from "../config/constants.js";
import ValidateUtils from "../utils/validate-utils.js";
import ZodUtils from "../utils/zod-utils.js";
import idSchema from "./common/id-schema.js";
import macSchema from "./common/mac-schema.js";

const {
    handleValidationIssues,
    zodEnumIgnoreCase,
    useRequiredProperties,
    withSuperRefine,
    ERROR_MESSAGES: { typeRequired, typeNotRequired, format, emptyArray, length, invalidEnum }
} = ZodUtils;
const {
    REGEX: { passwordRegex }
} = ValidateUtils;
const SAFE_TEXT_REGEX = /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 -]+$/;
const CONNECTIONS_CTYPE = Object.values(CONNECTION_TYPE);
const DEVICES_TYPE = Object.values(DEVICE_TYPE);
const { router, server } = DEVICE_TYPE;
const DEVICES_SCHEMA = z.object({
    name: z
        .string(typeRequired)
        .trim()
        .min(4, length(4, "min"))
        .max(30, length(30, "max"))
        .regex(SAFE_TEXT_REGEX, format),
    connections: z
        .array(
            z.object({
                mac: macSchema.shape.mac,
                ctype: zodEnumIgnoreCase(z.enum(CONNECTIONS_CTYPE, invalidEnum(CONNECTIONS_CTYPE)), typeRequired)
            }),
            typeRequired
        )
        .min(1, emptyArray),
    type: zodEnumIgnoreCase(z.enum(DEVICES_TYPE, invalidEnum(DEVICES_TYPE)), typeRequired),
    model: z
        .string(typeNotRequired)
        .trim()
        .min(8, length(8, "min"))
        .max(60, length(60, "max"))
        .regex(SAFE_TEXT_REGEX, format)
        .nullable()
        .default(null),
    ip: z
        .string(typeNotRequired)
        .trim()
        .regex(/^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/, format)
        .nullable()
        .default(null),
    ssid: z
        .string(typeNotRequired)
        .trim()
        .min(1, length(1, "min"))
        .regex(/^[\p{L}\p{N} ._-]+$/u, format)
        .nullable()
        .default(null),
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

/**
 * Devices validation schemas
 *
 * @author HattoriHanzo-Ronin
 */
export default class DevicesSchema {
    static getValidatedSchema(): typeof DEVICES_SCHEMA {
        return withSuperRefine(DEVICES_SCHEMA, DevicesSchema.cases);
    }

    static getPartialSchema(): z.ZodObject<z.core.util.Extend<ReturnType<typeof DEVICES_SCHEMA.partial>["shape"], typeof idSchema.shape>> {
        const partialSchema = useRequiredProperties(DEVICES_SCHEMA.partial(), idSchema.shape);
        return withSuperRefine(partialSchema, DevicesSchema.cases);
    }

    static getDeviceSchema(): z.ZodObject<z.core.util.Extend<Omit<typeof DEVICES_SCHEMA.shape, "connections">, typeof idSchema.shape>> {
        const schema = DEVICES_SCHEMA.omit({ connections: true }).extend(idSchema.shape);
        return withSuperRefine(schema, DevicesSchema.cases);
    }

    private static cases({ type, mac_filter, admin_pass, ip, ssid, wifi_pass, model, connections }: DeviceSchemaData, ctx: RefinementCtx): void {
        const isRouter = type === router;
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
                                },
                                {
                                    condition: wifi_pass !== null && ssid === null,
                                    path: ["ssid"],
                                    message: "Debe especificar el SSID"
                                },
                                {
                                    condition: ssid !== null && Buffer.byteLength(ssid as string, "utf8") > 32,
                                    path: ["ssid"],
                                    message: "Longitud superada"
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
                                },
                                {
                                    condition: ssid !== null,
                                    path: ["ssid"],
                                    message: "Solo el router soporta SSID"
                                }
                            ],
                            ctx
                        );
                    }
                },
                {
                    condition: type === server && ip === null,
                    path: ["ip"],
                    message: "Debe especificar ip del servidor"
                },
                {
                    condition: connections,
                    execute: () => {
                        const repeatedCtypes = new Map<string, number>();
                        for (const { ctype } of connections!) {
                            repeatedCtypes.set(ctype, (repeatedCtypes.get(ctype) ?? 0) + 1);
                        }
                        handleValidationIssues(
                            [...repeatedCtypes.entries()].map(([ctype, occurrences]) => ({
                                condition: occurrences > 1,
                                path: ["connections.ctype"],
                                message: `El ctype ${ctype} se encuentra duplicado`
                            })),
                            ctx
                        );
                    }
                }
            ],
            ctx
        );
    }
}
