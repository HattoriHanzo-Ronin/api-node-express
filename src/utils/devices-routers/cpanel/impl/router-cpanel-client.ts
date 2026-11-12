import { API_ERROR } from "../../../../config/errors.js";
import type RouterCpanel from "../router-cpanel.js";
import ApiError from "../../../error/api-error.js";
import Logger from "../../../logger/logger.js";
import { LOG_EVENT } from "../../../../config/log-events.js";
import type {
    CloseRouterCpanelParams,
    CreateRouterCpanelParams,
    NavigateRouterCpanelParams,
    RouterCpanelDependencies,
    RouterCpanelSession
} from "../../../../types/utils/router-cpanel.js";
import type { RouterCpanelRequestParams } from "../../../../types/utils/router-cpanel-client.js";
import type { ApiErrorResponse } from "../../../../types/utils/api-error.js";

const { routerCpanelServiceUnavailable, routerCpanelSessionFailed } = API_ERROR;

/**
 * Communicates with the router control panel service
 *
 * @author HattoriHanzo-Ronin
 */
export default class RouterCpanelClient implements RouterCpanel {
    private static readonly LOGGER = Logger.getLogger(RouterCpanelClient);

    private readonly routerCpanelServiceUrl: string;

    constructor({ routerCpanelServiceUrl }: RouterCpanelDependencies) {
        this.routerCpanelServiceUrl = routerCpanelServiceUrl;
    }

    async create({
        ownerId,
        routerName,
        routerIp,
        routerPassword,
        language,
        clientType,
        theme
    }: CreateRouterCpanelParams) {
        return (await this.request<RouterCpanelSession>({
            path: "/sessions",
            method: "POST",
            body: { ownerId, routerName, routerIp, routerPassword, language, clientType, theme }
        }))!;
    }

    async navigate({ sessionId, ownerId, action }: NavigateRouterCpanelParams) {
        await this.request({ path: `/sessions/${sessionId}/navigation`, method: "POST", body: { ownerId, action } });
    }

    async close({ sessionId, ownerId }: CloseRouterCpanelParams) {
        await this.request({ path: `/sessions/${sessionId}`, method: "DELETE", body: { ownerId } });
    }

    private async request<Result>({ path, method, body }: RouterCpanelRequestParams): Promise<Result | undefined> {
        const url = new URL(path, this.routerCpanelServiceUrl);
        let response: Response;
        try {
            response = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body)
            });
        } catch (error) {
            const password =
                "routerPassword" in body && typeof body.routerPassword === "string" ? body.routerPassword : "";
            RouterCpanelClient.LOGGER.error({
                event: LOG_EVENT.routerCpanelConnectionFailed,
                message: "Router panel service connection failed",
                error,
                redact: [password]
            });
            throw new ApiError({
                message: "No se ha podido conectar con el servicio de paneles de router",
                apiError: routerCpanelServiceUnavailable,
                cause: error
            });
        }

        if (response.ok) {
            return response.status === 204 ? undefined : ((await response.json()) as Result);
        }

        const { message, code }: Partial<ApiErrorResponse> = await response.json().catch(() => ({}));
        throw new ApiError({
            message: message ?? "No se ha podido gestionar la sesión del panel de router",
            status: response.status,
            apiError: code ?? routerCpanelSessionFailed
        });
    }
}
