export type DirectoryHash = {
    hash: string;
};

export type DirectoryCacheEntry = Map<string, DirectoryHash>;

export type DirectoryCacheEntries = Map<string, DirectoryCacheEntry>;

export type DirectoryCacheTimeouts = Map<string, Map<string, NodeJS.Timeout>>;
