export type Whitelist = {
    router_id: string;
    connection_mac: string;
    key: string | null;
};

export type WhitelistInsert = Whitelist;

export type WhitelistKey = {
    key: string;
};
