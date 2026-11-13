import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import axios, { AxiosInstance } from "axios";
import puppeteer, { Browser } from "puppeteer-core";
import { ENV } from "../../../../config/environment.js";
import { LOG_EVENT } from "../../../../config/log-events.js";
import Logger from "../../../logger/logger.js";
import {
    AddAllowParams,
    DeleteAllowParams,
    GeneratedKeysParams,
    RouterAutomationPayload,
    RouterCapabilities
} from "../../../../types/utils/router-automation.js";

/**
 * Base router implementation
 *
 * @author HattoriHanzo-Ronin
 */
export default abstract class AbstractRouter {
    private static readonly BROWSER_LOGGER = Logger.getLogger(AbstractRouter);
    private readonly router: RouterAutomationPayload;

    constructor({ router }: { router: RouterAutomationPayload }) {
        this.router = router;
    }

    /**
     * Retrieves supported router capabilities
     *
     * @returns Router capabilities
     */
    abstract getCapabilities(): RouterCapabilities;

    /**
     * Generates a router whitelist key
     *
     * @param params.keys Current router whitelist keys
     * @returns Generated whitelist key
     */
    abstract generateKey(params: GeneratedKeysParams): string | null;

    /**
     * Adds a device to the router whitelist
     *
     * @param params.key Router whitelist key
     * @param params.mac Device MAC address
     * @param params.name Device name
     * @returns Whether the operation succeeds
     */
    abstract addAllow(params: AddAllowParams): Promise<boolean>;

    /**
     * Removes a device from the router whitelist
     *
     * @param params.key Router whitelist key
     * @param params.mac Device MAC address
     * @returns Whether the operation succeeds
     */
    abstract deleteAllow(params: DeleteAllowParams): Promise<boolean>;

    /**
     * Returns the router base URL
     *
     * @returns Router base URL
     */
    protected getUrl(): string {
        return `http://${this.router.ip}`;
    }

    /**
     * Returns an Axios client with cookie support
     *
     * @returns Axios client
     */
    protected getAxiosClient(): AxiosInstance {
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
     * @returns Puppeteer browser
     */
    protected getPuppeteerBrowser(): Promise<Browser> {
        return puppeteer.launch({
            executablePath: ENV.chromePath,
            headless: true,
            args: ["--no-sandbox", "--disable-setuid-sandbox"]
        });
    }

    /**
     * Closes a Puppeteer browser
     *
     * @param browser Puppeteer browser
     * @returns Whether the browser was closed
     */
    protected async closePuppeteerBrowser(browser: Browser | undefined): Promise<boolean> {
        try {
            await browser?.close();
            return true;
        } catch (error) {
            const { id, admin_pass, ip } = this.router;
            AbstractRouter.BROWSER_LOGGER.warn({
                event: LOG_EVENT.routerAutomationError,
                message: "Router browser cleanup failed",
                context: `Router: ${id}`,
                error,
                redact: [admin_pass, ip]
            });
            return false;
        }
    }

    protected delay({ ms = 1500 }: { ms?: number }): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    protected getRouter(): RouterAutomationPayload {
        return this.router;
    }
}
