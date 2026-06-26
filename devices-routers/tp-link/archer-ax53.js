import AbstractRouter from "../abstract-router.js";

/**
 * TP-Link Archer AX53 router implementation
 *
 * @author HattoriHanzo-Ronin
 */
export default class ArcherAX53Router extends AbstractRouter {
    #browser;

    getCapabilities() {
        return {
            addAllow: true,
            deleteAllow: true
        };
    }

    async addAllow({ name, mac }) {
        try {
            mac = mac.replaceAll(":", "-");
            const page = await this.#openAccessControl();
            await delay(4800);
            const buttons = await page.$$('div[role="button"]');
            for (const button of buttons) {
                const text = await page.evaluate((el) => el.textContent, button);
                if (text?.includes("Añadir")) {
                    await page.evaluate((el) => el.click(), button);
                    break;
                }
            }
            await page.waitForSelector("span");
            const spans = await page.$$("span");
            for (const span of spans) {
                const text = await page.evaluate((el) => el.textContent, span);
                if (text?.includes("Agregar manualmente")) {
                    await page.evaluate((el) => el.click(), span);
                    break;
                }
            }
            await page.waitForSelector("input.su-input__content");
            const nameInput = await page.$("input.su-input__content");
            await nameInput.click({
                clickCount: 3
            });
            await nameInput.type(name);
            const macInputs = await page.$$("input.su-mac-input__partition");
            const macParts = mac.split("-");
            for (let i = 0; i < 6; i++) {
                await macInputs[i].click();
                await macInputs[i].type(macParts[i]);
            }
            await page.waitForSelector('div[role="button"], button');
            const confirmButtons = await page.$$('div[role="button"], button');
            for (const button of confirmButtons) {
                const text = await page.evaluate((el) => el.textContent, button);
                if (text?.trim() === "AÑADIR") {
                    await page.evaluate((el) => el.click(), button);
                    return true;
                }
            }
            return false;
        } catch {
            return false;
        } finally {
            await this.closePuppeteerBrowser(this.#browser);
        }
    }

    async deleteAllow({ mac }) {
        try {
            mac = mac.replaceAll(":", "-");
            const page = await this.#openAccessControl();
            await page.waitForSelector("tr.su-table__row");
            const rows = await page.$$("tr.su-table__row");
            for (const row of rows) {
                const rowText = await page.evaluate((el) => el.innerText, row);
                if (!rowText.includes(mac)) {
                    continue;
                }
                await page.waitForSelector('div[role="button"]');
                const buttons = await row.$$('div[role="button"]');
                let deleteButton = null;
                for (const button of buttons) {
                    const html = await page.evaluate((el) => el.innerHTML, button);
                    if (html.includes("fill-rule") && html.includes("currentColor")) {
                        deleteButton = button;
                    }
                }
                await page.evaluate((el) => el.click(), deleteButton);
                await page.waitForSelector('div[role="button"], button');
                const confirmButtons = await page.$$('div[role="button"], button');
                for (const button of confirmButtons) {
                    const text = await page.evaluate((el) => el.textContent, button);
                    if (text?.trim() === "OK") {
                        await page.evaluate((el) => el.click(), button);
                        return true;
                    }
                }
            }
            return false;
        } catch {
            return false;
        } finally {
            await this.closePuppeteerBrowser(this.#browser);
        }
    }

    /**
     * Opens the router access control page
     *
     * @returns {Promise<import("puppeteer").Page>} Router access control page
     */
    async #openAccessControl() {
        this.#browser = await this.getPuppeteerBrowser();
        const page = await this.#browser.newPage();
        await page.goto(this.getUrl(), {
            waitUntil: "networkidle2",
            timeout: 30000
        });
        await page.waitForSelector('input[type="password"]', {
            visible: true,
            timeout: 15000
        });
        await page.click('input[type="password"]', {
            clickCount: 3
        });
        await page.keyboard.press("Backspace");
        await page.type('input[type="password"]', this.router.admin_pass, {
            delay: 50
        });
        const loginButton = await page.$('button, input[type="submit"], .login-btn');
        await Promise.all([
            loginButton.click(),
            page
                .waitForNavigation({
                    waitUntil: "networkidle2",
                    timeout: 30000
                })
                .catch(() => {})
        ]);
        await delay();
        await page.evaluate(() => {
            window.location.hash = "/accessControl";
        });
        return page;
    }
}

function delay(ms = 1500) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}
