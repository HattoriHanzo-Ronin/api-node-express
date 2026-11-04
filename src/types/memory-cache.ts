export type MemoryCacheMap = Map<string, Buffer | null>;

export type MemoryCacheValues = Map<string, MemoryCacheMap>;

export type MemoryCacheEntry = {
    size: number;
    values: MemoryCacheValues;
};

export type MemoryCacheEntries = Map<string, MemoryCacheEntry>;

export type MemoryCacheTimeouts = Map<string, NodeJS.Timeout>;
