const DEVICE_TYPE = Object.freeze({ client: "CLIENT", router: "ROUTER", server: "SERVER" } as const);
const CONNECTION_TYPE = Object.freeze({ wan: "WAN", lan: "LAN", wifi: "WIFI" } as const);
const USER_ROLE = Object.freeze({ admin: "ADMIN", ftp: "FTP", net: "NET" } as const);
const FILE_TYPE = Object.freeze({ dir: "DIR", file: "FILE" } as const);
const FTP_TRANSFER_TYPE = Object.freeze({ upload: "UPLOAD", download: "DOWNLOAD" } as const);
const SOCKET_ENTITY = Object.freeze({
    devices: "devices",
    whitelist: "whitelist",
    users: "users",
    ftp: "ftp"
} as const);
const ROUTER_CPANEL_ACTION = Object.freeze({ back: "back", reload: "reload" } as const);
const ROUTER_CPANEL_CLIENT_TYPE = Object.freeze({ desktop: "desktop", mobile: "mobile" } as const);
const ROUTER_CPANEL_THEME = Object.freeze({ dark: "dark", light: "light" } as const);

export {
    FILE_TYPE,
    FTP_TRANSFER_TYPE,
    CONNECTION_TYPE,
    DEVICE_TYPE,
    SOCKET_ENTITY,
    USER_ROLE,
    ROUTER_CPANEL_ACTION,
    ROUTER_CPANEL_CLIENT_TYPE,
    ROUTER_CPANEL_THEME
};
