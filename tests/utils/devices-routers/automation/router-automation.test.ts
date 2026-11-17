import { describe, expect, it, vi } from "vitest";
import RouterAutomation from "../../../../src/utils/devices-routers/automation/impl/router-automation-manager.js";
import TLWDR5620GigabitEditionRouter from "../../../../src/utils/devices-routers/automation/routers/tp-link/tl-wdr5620-gigabit-edition.js";
import ArcherAX53Router from "../../../../src/utils/devices-routers/automation/routers/tp-link/archer-ax53.js";
import type { Browser } from "puppeteer-core";

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../../../../src/utils/logger/logger.js", () => ({ default: { getLogger: () => logger } }));

vi.mock("../../../../src/config/environment.js", () => ({ ENV: { chromePath: "/usr/bin/chromium" } }));

describe("RouterAutomation", () => {
    it("records browser cleanup failures without replacing the router operation result", async () => {
        const router = new ArcherAX53Router({
            router: {
                id: "router-1",
                name: "Router",
                model: "TP-Link Archer AX53",
                ip: "192.168.1.1",
                admin_pass: "secret"
            }
        });
        const operationError = new Error("Operation failed");
        const cleanupError = new Error("Browser close failed");
        router["browser"] = { close: vi.fn().mockRejectedValue(cleanupError) } as unknown as Browser;
        router["openAccessControl"] = vi.fn().mockRejectedValue(operationError);
        await expect(router.deleteAllow({ key: null, mac: "AA:BB:CC:DD:EE:01" })).resolves.toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                message: "Router browser cleanup failed",
                context: "Router: router-1",
                error: cleanupError,
                redact: ["secret", "192.168.1.1"]
            })
        );
    });

    it.each([["TP-Link TL-WDR5620 Gigabit Edition"], ["TP-Link Archer AX53"]])(
        "should create automation for %s",
        (model) => {
            const router = new RouterAutomation({
                router: { id: "router-1", name: "Router", model, ip: "192.168.1.1", admin_pass: "RouterPassword123!" }
            });

            expect(router.getCapabilities()).toEqual({ addAllow: true, deleteAllow: true });
        }
    );

    it("records the router response and protects credentials when an operation is rejected", async () => {
        const router = new TLWDR5620GigabitEditionRouter({
            router: {
                id: "router-1",
                name: "Router",
                model: "TP-Link TL-WDR5620 Gigabit Edition",
                ip: "192.168.1.1",
                admin_pass: "secret"
            }
        });
        vi.spyOn(router, "loginOnRouter").mockResolvedValue("token");
        vi.spyOn(router["client"], "post").mockResolvedValue({ data: { error_code: 42, password: "secret" } });
        await expect(router.deleteAllow({ key: "key-1", mac: "AA:BB:CC:DD:EE:01" })).resolves.toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "router.automation.error",
                message: "Router automation failed",
                context: "Router: router-1\nDevice MAC: AA:BB:CC:DD:EE:01\nKey: key-1\nOperation: delete",
                error: {
                    cause: expect.objectContaining({ message: expect.stringContaining("code 42") }),
                    result: { error_code: 42, password: "secret" }
                },
                redact: ["secret", "192.168.1.1"],
                completeResult: true
            })
        );
    });

    it("transforms a rejected router operation into the API error used for rollback", async () => {
        vi.spyOn(TLWDR5620GigabitEditionRouter.prototype, "deleteAllow").mockResolvedValueOnce(false);
        const router = new RouterAutomation({
            router: {
                id: "router-1",
                name: "Router",
                model: "TP-Link TL-WDR5620 Gigabit Edition",
                ip: "192.168.1.1",
                admin_pass: "secret"
            }
        });
        await expect(router.delete({ key: "key-1", mac: "AA:BB:CC:DD:EE:01" })).rejects.toMatchObject({
            code: "ROUTER_DELETE_FAILED"
        });
    });

    it("records the router response when the HTTP request fails", async () => {
        const router = new TLWDR5620GigabitEditionRouter({
            router: {
                id: "router-1",
                name: "Router",
                model: "TP-Link TL-WDR5620 Gigabit Edition",
                ip: "192.168.1.1",
                admin_pass: "secret"
            }
        });
        const response = { error_code: 42, reason: "rejected" };
        vi.spyOn(router, "loginOnRouter").mockResolvedValue("token");
        vi.spyOn(router["client"], "post").mockRejectedValue(
            Object.assign(new Error("HTTP failure"), { isAxiosError: true, response: { data: response } })
        );
        await expect(router.deleteAllow({ key: "key-1", mac: "AA:BB:CC:DD:EE:01" })).resolves.toBe(false);
        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({ error: expect.objectContaining({ result: response }) })
        );
    });

    it("should fail when no implementation is available", () => {
        expect(() => {
            return new RouterAutomation({
                router: {
                    id: "router-1",
                    name: "Router",
                    model: "Unknown",
                    ip: "192.168.1.1",
                    admin_pass: "RouterPassword123!"
                }
            });
        }).toThrow("Router no tiene implementación disponible");
        expect(logger.warn).toHaveBeenCalledWith({
            event: "router.operation.failed",
            message: "Router automation is unavailable",
            context: "Router: router-1\nModel: Unknown"
        });
    });
});
