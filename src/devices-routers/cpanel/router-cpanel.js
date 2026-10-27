import ApiError from "../../utils/error/api-error.js";
import { API_ERROR } from "../../config/errors.js";

/**
 * Communicates with the router control panel service
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterCpanel {
    constructor({ routerCpanelServiceUrl }) {
        this.routerCpanelServiceUrl = routerCpanelServiceUrl;
    }

    /**
     * Creates a router control panel session
     *
     * @param {string} params.ownerId Authenticated user identifier
     * @param {string} params.routerName Router display name
     * @param {string} params.routerIp Router control panel IP address
     * @param {string} params.routerPassword Router control panel password
     * @param {string | undefined} params.language Viewer language
     * @param {"desktop" | "mobile"} params.clientType Viewer client type
     * @param {"dark" | "light"} params.theme Viewer theme
     * @returns {Promise<{ id: string, url: string, expiresAt: string }>} Router control panel session
     */
    async create({ ownerId, routerName, routerIp, routerPassword, language, clientType, theme }) {
        return this.#request({
            path: "/sessions",
            method: "POST",
            body: { ownerId, routerName, routerIp, routerPassword, language, clientType, theme }
        });
    }

    /**
     * Navigates a router control panel session
     *
     * @param {string} params.sessionId Router control panel session identifier
     * @param {string} params.ownerId Authenticated user identifier
     * @param {"back" | "reload"} params.action Browser navigation action
     */
    async navigate({ sessionId, ownerId, action }) {
        await this.#request({ path: `/sessions/${sessionId}/navigation`, method: "POST", body: { ownerId, action } });
    }

    /**
     * Deletes a router control panel session
     *
     * @param {string} params.sessionId Router control panel session identifier
     * @param {string} params.ownerId Authenticated user identifier
     */
    async close({ sessionId, ownerId }) {
        await this.#request({ path: `/sessions/${sessionId}`, method: "DELETE", body: { ownerId } });
    }

    async #request({ path, method, body }) {
        const url = new URL(path, this.routerCpanelServiceUrl);
        let response;
        try {
            response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
        } catch {
            throw new ApiError({
                message: "No se ha podido conectar con el servicio de paneles de router",
                apiError: routerCpanelServiceUnavailable
            });
        }

        if (response.ok) {
            return response.status === 204 ? undefined : response.json();
        }

        const data = await response.json().catch(() => ({}));
        throw new ApiError({
            message: data.message ?? "No se ha podido gestionar la sesión del panel de router",
            status: response.status,
            apiError: { code: data.code ?? routerCpanelSessionFailed.code }
        });
    }
}

const { routerCpanelServiceUnavailable, routerCpanelSessionFailed } = API_ERROR;
