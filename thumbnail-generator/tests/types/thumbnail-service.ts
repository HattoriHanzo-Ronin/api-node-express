import type { EventEmitter } from "node:events";
import type { Server } from "node:http";
import type { DefaultThumbnailService } from "../../src/services/impl/default-thumbnail-service.js";

export type ThumbnailService = typeof DefaultThumbnailService;

export type ResourceUsage = {
    cpu: number;
    memory: number;
};

export type MockChildProcess = EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter & { setEncoding: () => void };
    kill: () => void;
};

export type ThumbnailServiceTestState = {
    paths: (string | undefined)[];
    ranges: (string | undefined)[];
    fixtureDir: string;
    fixture: string;
    server: Server;
    service: ThumbnailService;
};

export type ByteRange = {
    start: number;
    end: number;
    partial: boolean;
};
