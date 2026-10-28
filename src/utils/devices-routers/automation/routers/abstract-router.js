import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import axios from "axios";
import puppeteer from "puppeteer-core";
import { ENV } from "../../../../config/environment.js";
import { API_ERROR } from "../../../../config/errors.js";
import ApiError from "../../../error/api-error.js";

const { routerImplementationNotFound } = API_ERROR;

/**
 * Base router implementation
 *
 * @author HattoriHanzo-Ronin
 */
export default class AbstractRouter {
    constructor({ router }) {
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
     * @returns {string | null} Generated whitelist key
     */
    generateKey() {
        return null;
    }

    /**
     * Adds a device to the router whitelist
     *
     * @returns {Promise<boolean>} Returns true when the operation succeeds, otherwise false
     */
    async addAllow() {
        throw new ApiError({
            message: "La inserción en el router no está implementada",
            apiError: routerImplementationNotFound
        });
    }

    /**
     * Removes a device from the router whitelist
     *
     * @returns {Promise<boolean>} Returns true when the operation succeeds, otherwise false
     */
    async deleteAllow() {
        throw new ApiError({
            message: "El borrado en el router no está implementado",
            apiError: routerImplementationNotFound
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
