import ValidateUtils from "./validate-utils.js";

/**
 * Centralizes the translation of PostgreSQL errors into application errors
 */
export default class PostgresErrors {
    static whitelist(err) {
        handleApiErrors([
            {
                condition: err.code === UNIQUE_VIOLATION,
                execute: () => {
                    handleApiErrors([
                        {
                            condition: err.constraint === "whitelist_pk",
                            message: "El dispositivo ya se encuentra autorizado",
                            status: 400,
                            code: "WHITELIST_ALREADY_ALLOWED"
                        },
                        {
                            condition: err.constraint === "whitelist_router_id_key_unique",
                            message: "Error al generar la clave de autorización",
                            code: "WHITELIST_KEY_GENERATION_FAILED"
                        }
                    ]);
                }
            }
        ]);
    }

    static devices(err) {
        handleApiErrors([
            {
                condition: err.code === UNIQUE_VIOLATION,
                execute: () => {
                    handleApiErrors([
                        {
                            condition: err.constraint === "devices_name_unique",
                            message: "El nombre del dispositivo ya está en uso",
                            status: 409,
                            code: "DEVICE_NAME_ALREADY_EXISTS"
                        },
                        {
                            condition: err.constraint === "devices_ip_unique",
                            message: "La ip ya está en uso",
                            status: 409,
                            code: "DEVICE_IP_ALREADY_IN_USE"
                        },
                    ]);
                }
            }
        ]);
    }

    static connections(err) {
        handleApiErrors([
            {
                condition: err.code === UNIQUE_VIOLATION,
                message: "La mac ya está en uso",
                status: 409,
                code: "CONNECTION_MAC_ALREADY_EXISTS"
            }
        ]);
    }

    static users(err) {
        handleApiErrors([
            {
                condition: err.code === UNIQUE_VIOLATION,
                message: "El nombre de usuario ya está en uso",
                status: 409,
                code: "USER_USERNAME_ALREADY_EXISTS"
            }
        ]);
    }

    static refreshTokens(err) {
        handleApiErrors([
            {
                condition: err.code === FOREIGN_KEY_VIOLATION,
                message: "El usuario no existe",
                status: 404,
                code: "REFRESH_TOKEN_USER_NOT_FOUND"
            }
        ]);
    }
}

const UNIQUE_VIOLATION = "23505";
const FOREIGN_KEY_VIOLATION = "23503";
const { handleApiErrors } = ValidateUtils;
