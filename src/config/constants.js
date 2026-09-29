import ObjectUtils from "../utils/object-utils.js";

const FILE_TYPE = Object.freeze({ dir: "DIR", file: "FILE" });
const CACHE = Object.freeze({
    maxSize: 2 * 1024 ** 3,
    maxSizePerUser: 400 * 1024 ** 2,
    inactivityTimeout: 10 * 60 * 1000
});
const CONNECTION_CTYPE = Object.freeze({ wan: "WAN", lan: "LAN", wifi: "WIFI" });
const DEVICE_TYPE = Object.freeze({ client: "CLIENT", router: "ROUTER", server: "SERVER" });
const USER_ROLE = Object.freeze({ admin: "ADMIN", ftp: "FTP", net: "NET" });
const DATA_VERSION = Object.freeze({ devices: "devices", whitelist: "whitelist", users: "users" });
const VALIDATION = ObjectUtils.deepFreeze({
    allowEnums: {
        fileType: Object.values(FILE_TYPE),
        connectionsCtype: Object.values(CONNECTION_CTYPE),
        devicesType: Object.values(DEVICE_TYPE),
        userRoles: Object.values(USER_ROLE),
        dataVersions: Object.values(DATA_VERSION)
    },
    errorMessages: {
        typeRequired: { error: (issue) => (issue.input === undefined ? "Requerido" : "Tipo no válido") },
        typeNotRequired: { error: "Tipo no válido" },
        format: "Error de formato",
        length: (num, mode) =>
            `Longitud ${mode === "min" ? "mínima" : "máxima"} ${num} ${num > 1 ? "caracteres" : "caracter"}`,
        invalidEnum: (values) => ({ error: `Valores permitidos: ${values.join(", ")}` }),
        invalidId: "UUID no válido",
        emptyArray: "Debe contener al menos un elemento",
        emptyString: "No puede estar vacío"
    },
    regex: {
        passwordRegex: /^[A-Za-z0-9!@#$%^&*()_\-+=\[{\]};:'",<.>/?\\|`~]+$/,
        macRegex: /^([0-9A-Fa-f]{2}:){5}[0-9A-Fa-f]{2}$/,
        ipRegex: /^((25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)\.){3}(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)$/,
        safeTextRegex: /^[A-Za-zÁÉÍÓÚáéíóúÑñ0-9 -]+$/,
        pathRegex: /^[\p{L}\p{N} ./_-]+$/u
    }
});
const JWT = Object.freeze({ accessTokenExpiresIn: "30min", refreshTokenExpiresIn: "60d" });

export { FILE_TYPE, CACHE, DEVICE_TYPE, USER_ROLE, DATA_VERSION, VALIDATION, JWT };
