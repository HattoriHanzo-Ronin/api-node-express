import AbstractRouter from "../abstract-router.js";

/**
 * TP-Link TL-WDR5620 Gigabit Edition router implementation
 *
 * @author HattoriHanzo-Ronin
 */
export default class TLWDR5620GigabitEditionRouter extends AbstractRouter {
    #client = this.getAxiosClient();

    /**
     * Returns supported router capabilities
     *
     * @returns {{ addAllow: boolean, deleteAllow: boolean }} Router capabilities
     */
    getCapabilities() {
        return {
            addAllow: true,
            deleteAllow: true
        };
    }

    /**
     * Generates a whitelist key
     *
     * @param {Object[]} params.keys Existing whitelist keys
     * @returns {string} Whitelist key
     */
    generateKey({ keys }) {
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

    /**
     * Adds a device to the router whitelist
     *
     * @param {string} params.key Whitelist key
     * @param {string} params.mac Device MAC address
     * @param {string} params.name Device name
     * @returns {Promise<boolean>} Whether the device was added
     */
    async addAllow({ key, mac, name }) {
        return this.#postOnRouter({
            method: "add",
            wlan_access: {
                name: key,
                para: { mac: mac.replaceAll(":", "-"), name },
                table: "white_list"
            }
        });
    }

    /**
     * Removes a device from the router whitelist
     *
     * @param {string} params.key Whitelist key
     * @returns {Promise<boolean>} Whether the device was removed
     */
    async deleteAllow({ key }) {
        return this.#postOnRouter({ method: "delete", wlan_access: { name: [key] } });
    }

    /**
     * Executes a router operation request
     *
     * @param {Object} data Router request payload
     * @returns {Promise<boolean>} Returns true when the operation succeeds, otherwise false
     */
    async #postOnRouter(data) {
        try {
            const stok = await this.#loginOnRouter();
            const result = await this.#client.post(this.getUrl() + `/stok=${stok}/ds`, data, {
                headers: { "Content-Type": "application/json" }
            });
            return result.data?.error_code === 0;
        } catch {
            return false;
        }
    }

    /**
     * Authenticates against the router and retrieves a session token
     *
     * @returns {Promise<string>} Router session token
     */
    async #loginOnRouter() {
        const securityEncode = () => {
            const password = this.router.admin_pass;
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
        const login = await this.#client.post(
            this.getUrl(),
            { login: { password: securityEncode() }, method: "do" },
            { headers: { "Content-Type": "application/json" } }
        );
        return login.data.stok;
    }
}
