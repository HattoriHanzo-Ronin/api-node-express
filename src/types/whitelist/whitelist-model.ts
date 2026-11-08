export type Whitelist = {
    router_id: string;
    connection_mac: string;
    key: string | null;
};

export type WhitelistKey = {
    key: string;
};

export type InsertWhitelistParams<Transaction> = { clientTx: Transaction; whitelist: Whitelist };
export type DeleteWhitelistParams<Transaction> = { clientTx: Transaction; routerId: string; mac: string };
