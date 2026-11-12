import { closeSync, mkdirSync, openSync, readdirSync, rmdirSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";
import { ENV } from "../../config/environment.js";
import type { LogEvent, LoggerOptions, LogLevel } from "../../types/logger/logger.js";

/**
 * Persistent JSON application logger
 *
 * @author HattoriHanzo-Ronin
 */
export default class Logger {
    private static readonly LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];
    private static cleanupTimer?: NodeJS.Timeout;
    private static file?: { date: string; descriptor: number };
    private readonly options: LoggerOptions;
    private readonly source: string;

    private constructor(options: LoggerOptions, source: string) {
        this.options = options;
        this.source = source;
    }

    /**
     * Returns a logger for the given class
     *
     * @param source Class that owns the logger
     * @returns Class logger
     */
    static getLogger(source: { name: string }): Logger {
        const { logLevel, logDirectory, logRetentionWeeks } = ENV;
        const options = { level: logLevel, directory: logDirectory, retentionWeeks: logRetentionWeeks };
        if (!Logger.cleanupTimer) {
            Logger.cleanup(options);
            Logger.scheduleCleanup(options);
        }

        return new Logger(options, source.name);
    }

    /**
     * Records a debug event
     *
     * @param data Log event
     */
    debug(data: LogEvent): void {
        this.write("debug", data);
    }

    /**
     * Records an informational event
     *
     * @param data Log event
     */
    info(data: LogEvent): void {
        this.write("info", data);
    }

    /**
     * Records a warning event
     *
     * @param data Log event
     */
    warn(data: LogEvent): void {
        this.write("warn", data);
    }

    /**
     * Records an error event
     *
     * @param data Log event
     */
    error(data: LogEvent): void {
        this.write("error", data);
    }

    private write(level: LogLevel, { event, message, context, error }: LogEvent): void {
        if (Logger.LEVELS.indexOf(level) < Logger.LEVELS.indexOf(this.options.level)) {
            return;
        }

        try {
            const timestamp = new Date().toISOString();
            const date = timestamp.slice(0, 10);
            const directory = path.join(this.options.directory, date.slice(0, 7));
            const seen = new WeakSet<object>();
            const record = {
                timestamp,
                level,
                service: "thumbnail-generator",
                source: this.source,
                event,
                message,
                context,
                error
            };
            if (Logger.file?.date !== date) {
                Logger.closeFile();
                mkdirSync(directory, { recursive: true });
                Logger.file = { date, descriptor: openSync(path.join(directory, `${date}.log`), "a") };
            }

            writeFileSync(Logger.file.descriptor, `${JSON.stringify(Logger.sanitize(record, seen, 0))}\n`);
        } catch {
            Logger.closeFile();
        }
    }

    private static closeFile(): void {
        if (Logger.file) {
            try {
                closeSync(Logger.file.descriptor);
            } catch {}

            Logger.file = undefined;
        }
    }

    private static sanitize(value: unknown, seen: WeakSet<object>, depth: number): unknown {
        if (depth > 8) {
            return "[truncated]";
        }

        if (typeof value === "string") {
            return value
                .slice(0, 2048)
                .replace(/https?:\/\/[^\s)]+/gi, "[url]")
                .replace(/\bBearer\s+[^\s,;"']+/gi, "Bearer [redacted]")
                .replace(
                    /(["']?(?:password|secret|token|authorization|cookie|credential)["']?\s*[:=]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/gi,
                    "$1[redacted]"
                )
                .replace(/(?:[A-Za-z]:)?\/(?:[^\s/:]+\/)+[^\s:)]*/g, "[path]");
        }

        if (value === null || typeof value !== "object") {
            return typeof value === "bigint" ? value.toString() : value;
        }

        if (seen.has(value)) {
            return "[circular]";
        }

        seen.add(value);
        if (Array.isArray(value)) {
            const items = value.slice(0, 50).map((item) => Logger.sanitize(item, seen, depth + 1));
            seen.delete(value);
            return items;
        }

        const entries: [string, unknown][] =
            value instanceof Error
                ? Object.entries(
                      Object.assign(
                          { name: value.name, message: value.message, stack: value.stack, cause: value.cause },
                          value
                      )
                  )
                : Object.entries(value);
        const result = Object.fromEntries(
            entries.slice(0, 50).map(([key, item]) => {
                return [
                    key,
                    /password|secret|token|cookie|authorization|credential|path|url/i.test(key)
                        ? "[redacted]"
                        : Logger.sanitize(item, seen, depth + 1)
                ];
            })
        );
        seen.delete(value);
        return result;
    }

    private static cleanup({ directory: logDirectory, retentionWeeks }: LoggerOptions): void {
        try {
            const now = new Date();
            const monday = Date.UTC(
                now.getUTCFullYear(),
                now.getUTCMonth(),
                now.getUTCDate() - ((now.getUTCDay() + 6) % 7)
            );
            const cutoff = monday - retentionWeeks * 7 * 24 * 60 * 60 * 1000;
            for (const month of readdirSync(logDirectory, { withFileTypes: true })) {
                if (!month.isDirectory() || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month.name)) {
                    continue;
                }

                const directory = path.join(logDirectory, month.name);
                for (const file of readdirSync(directory, { withFileTypes: true })) {
                    if (
                        !file.isFile() ||
                        !/^\d{4}-\d{2}-\d{2}\.log$/.test(file.name) ||
                        !file.name.startsWith(`${month.name}-`)
                    ) {
                        continue;
                    }

                    const date = file.name.slice(0, 10);
                    const time = Date.parse(`${date}T00:00:00.000Z`);
                    if (Number.isFinite(time) && new Date(time).toISOString().slice(0, 10) === date && time < cutoff) {
                        unlinkSync(path.join(directory, file.name));
                    }
                }

                if (!readdirSync(directory).length) {
                    rmdirSync(directory);
                }
            }
        } catch {}
    }

    private static scheduleCleanup(options: LoggerOptions): void {
        const now = new Date();
        const nextMonday = Date.UTC(
            now.getUTCFullYear(),
            now.getUTCMonth(),
            now.getUTCDate() + 7 - ((now.getUTCDay() + 6) % 7)
        );
        Logger.cleanupTimer = setTimeout(() => {
            Logger.cleanup(options);
            Logger.scheduleCleanup(options);
        }, nextMonday - now.getTime());
        Logger.cleanupTimer.unref();
    }
}
