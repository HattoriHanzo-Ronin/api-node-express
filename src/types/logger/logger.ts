export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogEvent = {
    event: string;
    message: string;
    context?: string;
    error?: unknown;
    redact?: string[];
};

export type LoggerOptions = { level: LogLevel; directory: string; retentionWeeks: number };
