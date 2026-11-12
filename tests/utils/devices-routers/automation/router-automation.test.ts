import { describe, expect, it, vi } from "vitest";
import RouterAutomation from "../../../../src/utils/devices-routers/automation/impl/router-automation-manager.js";
import TLWDR5620GigabitEditionRouter from "../../../../src/utils/devices-routers/automation/routers/tp-link/tl-wdr5620-gigabit-edition.js";

const logger = vi.hoisted(() => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }));
vi.mock("../../../../src/utils/logger/logger.js", () => ({ default: { getLogger: () => logger } }));

vi.mock("../../../../src/config/environment.js", () => ({ ENV: { chromePath: "/usr/bin/chromium" } }));

describe("RouterAutomation", () => {
    it.each([["TP-Link TL-WDR5620 Gigabit Edition"], ["TP-Link Archer AX53"]])(
        "should create automation for %s",
        (model) => {
            const router = new RouterAutomation({
                router: { id: "router-1", name: "Router", model, ip: "192.168.1.1", admin_pass: "RouterPassword123!" }
            });

            expect(router.getCapabilities()).toEqual({ addAllow: true, deleteAllow: true });
        }
    );

    it("records a router rejection code without exposing its response or credentials", async () => {
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
        expect(logger.warn).toHaveBeenCalledWith({
            event: "router.automation.error",
            message: "Router rejected an automation operation",
            context: "Router: router-1, code: 42"
        });
    });

    it("records a failed router operation when its implementation returns false", async () => {
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
        expect(logger.warn).toHaveBeenCalledWith(
            expect.objectContaining({
                event: "router.operation.failed",
                context: "Router: router-1, operation: delete"
            })
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
    });
});
