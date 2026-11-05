import type { $ZodRawIssue } from "zod/v4/core";

export type ZodErrorMessages = {
    typeRequired: { error: (issue: $ZodRawIssue) => string };
    typeNotRequired: { error: string };
    format: string;
    length: (num: number, mode: "min" | "max") => string;
    invalidEnum: (values: readonly string[]) => { error: string };
    emptyArray: string;
    emptyString: string;
};

export type ValidationIssue = {
    condition: unknown;
    path?: PropertyKey[];
    message?: string;
    execute?: () => void;
};
