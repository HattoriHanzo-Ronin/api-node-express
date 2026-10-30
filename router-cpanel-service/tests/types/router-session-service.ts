import type { EventEmitter } from "node:events";
import type { Mock } from "vitest";

export type RouterSessionTokenPayload = {
    sid: string;
};

export type RouterSessionTestPage = {
    on: Mock;
    setViewport: Mock;
    goto: Mock;
    url: Mock<() => string>;
    frames: Mock<() => RouterSessionTestFrame[]>;
    goBack: Mock;
    reload: Mock;
};

export type RouterSessionTestFrame = { evaluate: Mock };
export type RouterSessionTestBrowser = { pages: Mock; newPage: Mock; close: Mock };
export type RouterSessionTestChildProcess = EventEmitter & { kill: Mock };
export type RouterSessionTestSocket = EventEmitter & { destroy: Mock };

export type RouterSessionTestMocks = {
    mkdtemp: Mock;
    rm: Mock;
    launch: Mock;
    createConnection: Mock;
    spawn: Mock;
    browser: RouterSessionTestBrowser;
    page: RouterSessionTestPage;
};
