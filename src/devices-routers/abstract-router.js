import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import axios from "axios";
import puppeteer from "puppeteer-core";
import { ENV } from "../config/environment.js";
import { API_ERROR } from "../config/errors.js";
import ApiError from "../utils/error/api-error.js";

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
    generateKey(keys) {
        return null;
    }

    /**
     * Adds a device to the router whitelist
     *
     * @param {string | null} params.key Router whitelist key
     * @param {string} params.mac Device MAC address
     * @param {string} params.name Device name
     * @returns {Promise<boolean>} Returns true when the operation succeeds, otherwise false
     */
    async addAllow({ key, mac, name }) {
        throw new ApiError({
            message: "La inserción en el router no está implementada",
            apiError: API_ERROR.routerImplementationNotFound
        });
    }

    /**
     * Removes a device from the router whitelist
     *
     * @param {string | null} params.key Router whitelist key
     * @param {string} params.mac Device MAC address
     * @returns {Promise<boolean>} Returns true when the operation succeeds, otherwise false
     */
    async deleteAllow({ key, mac }) {
        throw new ApiError({
            message: "El borrado en el router no está implementado",
            apiError: API_ERROR.routerImplementationNotFound
        });
    }

    /**
     * Returns the router base URL
     *
     * @returns {string} Router base URL
     */
    getUrl() {
        return `http://${this.router.ip}`;
    }

    /**
     * Returns an Axios client with cookie support
     *
     * @returns {import("axios").AxiosInstance} Axios client
     */
    getAxiosClient() {
        const jar = new CookieJar();
        return wrapper(
            axios.create({
                jar,
                withCredentials: true
            })
        );
    }

    /**
     * Opens a Puppeteer browser
     *
     * @returns {Promise<import("puppeteer").Browser>} Puppeteer browser
     */
    getPuppeteerBrowser() {
        return puppeteer.launch({
            executablePath: ENV.chromePath,
            headless: "new",
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
    }

    /**
     * Closes a Puppeteer browser
     *
     * @param {import("puppeteer").Browser | undefined} browser Puppeteer browser
     */
    async closePuppeteerBrowser(browser) {
        if (browser) {
            await browser.close();
        }
    }
}
