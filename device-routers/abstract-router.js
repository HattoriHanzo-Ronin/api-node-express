import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import axios from "axios";
import puppeteer from "puppeteer-core";

/**
 * Base router implementation
 *
 * @author HattoriHanzo-Ronin
 */
export default class AbstractRouter {
    constructor(router) {
        this.router = router;
    }

    /**
     * Retrieves supported router capabilities
     *
     * @returns {{ addAllow: boolean, deleteAllow: boolean }} Router capabilities
     */
    getCapabilities() {
        return {
            addAllow: false,
            deleteAllow: false
        };
    }

    /**
     * Generates a router whitelist key
     *
     * @param {string[]} keys Current router whitelist keys
     * @returns {string | null} Generated whitelist key
     */
    getKey(keys) {
        return null;
    }

    /**
     * Adds a device to the router whitelist
     *
     * @param {string | null} params.key Router whitelist key
     * @param {string} params.deviceMac Device MAC address
     * @param {string} params.deviceName Device name
     * @returns {Promise<boolean>} Returns true when the operation succeeds, otherwise false
     */
    async addAllow({ key, deviceMac, deviceName }) {
        throw new Error("Not implemented");
    }

    /**
     * Removes a device from the router whitelist
     *
     * @param {string | null} params.key Router whitelist key
     * @param {string} params.deviceMac Device MAC address
     * @returns {Promise<boolean>} Returns true when the operation succeeds, otherwise false
     */
    async deleteAllow({ key, deviceMac }) {
        throw new Error("Not implemented");
    }

    getUrl() {
        return `http://${this.router.ip}`;
    }

    getAxiosClient() {
        const jar = new CookieJar();
        return wrapper(
            axios.create({
                jar,
                withCredentials: true
            })
        );
    }

    async getPuppeteerBrowser() {
        return await puppeteer.launch({
            executablePath: process.env.CHROME_PATH,
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
    }

    async closePuppeteerBrowser(browser) {
        if (browser) {
            await browser.close();
        }
    }
}
