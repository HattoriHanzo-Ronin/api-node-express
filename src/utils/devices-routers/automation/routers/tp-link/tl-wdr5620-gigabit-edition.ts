import {
    AddAllowParams,
    DeleteAllowParams,
    GeneratedKeysParams
} from "../../../../../types/utils/router-automation.js";
import AbstractRouter from "../abstract-router.js";
import { LOG_EVENT } from "../../../../../config/log-events.js";
import Logger from "../../../../logger/logger.js";
import axios from "axios";

/**
 * TP-Link TL-WDR5620 Gigabit Edition router implementation
 *
 * @author HattoriHanzo-Ronin
 */
export default class TLWDR5620GigabitEditionRouter extends AbstractRouter {
    private static readonly LOGGER = Logger.getLogger(TLWDR5620GigabitEditionRouter);
    private client = this.getAxiosClient();

    getCapabilities() {
        return {
            addAllow: true,
            deleteAllow: true
        };
    }

    generateKey({ keys }: GeneratedKeysParams) {
        let num = 0;
        keys.sort((a, b) => {
            const aK = Number(a.key.split("_").pop()),
                bK = Number(b.key.split("_").pop());
            return aK - bK;
        });
        for (let ind = 0; ind < keys.length; ind++) {
            num = Number(keys[ind].key.split("_").pop());
            if (num - ind > 1) {
                return `white_list_${num - 1}`;
            }
        }
        return `white_list_${num + 1}`;
    }

    async addAllow({ key, mac, name }: AddAllowParams) {
        return this.postOnRouter({
            data: {
                method: "add",
                wlan_access: {
                    name: key,
                    para: { mac: mac.replaceAll(":", "-"), name },
                    table: "white_list"
                }
            },
            key,
            mac,
            operation: "add"
        });
    }

    async deleteAllow({ key, mac }: DeleteAllowParams) {
        return this.postOnRouter({
            data: { method: "delete", wlan_access: { name: [key] } },
            key,
            mac,
            operation: "delete"
        });
    }

    /**
     * Executes a router operation request
     *
     * @param params.data Router request payload
     * @param params.key Router whitelist key
     * @param params.mac Device MAC address
     * @param params.operation Router operation
     * @returns {Promise<boolean>} Returns true when the operation succeeds, otherwise false
     */
    async postOnRouter({
        data,
        key,
        mac,
        operation
    }: {
        data: object;
        key: AddAllowParams["key"];
        mac: string;
        operation: string;
    }): Promise<boolean> {
        let resultData: unknown;
        try {
            const stok = await this.loginOnRouter();
            const result = await this.client.post(this.getUrl() + `/stok=${stok}/ds`, data, {
                headers: { "Content-Type": "application/json" }
            });
            resultData = result.data;
            const code: unknown = result.data?.error_code;
            if (typeof code === "number" && code !== 0) {
                throw new Error(`Router rejected automation operation with code ${code}`);
            }

            if (code !== 0) {
                throw new Error("Router returned an invalid automation response");
            }

            return true;
        } catch (error) {
            const { id, admin_pass, ip } = this.getRouter();
            if (axios.isAxiosError(error)) {
                resultData ??= error.response?.data;
            }

            TLWDR5620GigabitEditionRouter.LOGGER.warn({
                event: LOG_EVENT.routerAutomationError,
                message: "Router automation failed",
                context: `Router: ${id}\nDevice MAC: ${mac}\nKey: ${key}\nOperation: ${operation}`,
                error: { cause: error, result: resultData },
                redact: [admin_pass, ip],
                completeResult: true
            });
            return false;
        }
    }

    /**
     * Authenticates against the router and retrieves a session token
     *
     * @returns Router session token
     */
    async loginOnRouter(): Promise<string> {
        const securityEncode = () => {
            const password = this.getRouter().admin_pass;
            const key = "RDpbLfCPsJZ7fiv";
            const dict =
                "yLwVl0zKqws7LgKPRQ84Mdt708T1qQ3Ha7xv3H7NyU84p21BriUWBU43odz3iP4rBL3cD02KZciXTys" +
                "VXiV8ngg6vL48rPJyAUw0HurW20xqxv9aYb4M9wK1Ae0wlro510qXeU07kV57fQMc8L6aLgMLwygtc0F10a0Dg70TOoou" +
                "yFhdysuRMO51yY5ZlOZZLEal1h0t9YQW0Ko7oBwmCAHoic4HYbUyVeU3sfQ1xtXcPcf1aT303wAQhv66qzW";
            const g = key.length;
            const h = password.length;
            const k = dict.length;
            const f = g > h ? g : h;
            let e = "";

            for (let p = 0; p < f; p++) {
                let l = 187;
                let n = 187;

                if (p >= g) {
                    n = password.charCodeAt(p);
                }

                if (p < g && p >= h) {
                    l = key.charCodeAt(p);
                }

                if (p < g && p < h) {
                    l = key.charCodeAt(p);
                    n = password.charCodeAt(p);
                }

                e += dict.charAt((l ^ n) % k);
            }

            return e;
        };
        const login = await this.client.post(
            this.getUrl(),
            { login: { password: securityEncode() }, method: "do" },
            { headers: { "Content-Type": "application/json" } }
        );
        return login.data.stok;
    }
}
