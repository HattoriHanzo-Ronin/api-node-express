const FILE_TYPE = Object.freeze({ dir: "DIR", file: "FILE" });
const CONNECTION_CTYPE = Object.freeze({ wan: "WAN", lan: "LAN", wifi: "WIFI" });
const DEVICE_TYPE = Object.freeze({ client: "CLIENT", router: "ROUTER", server: "SERVER" });
const USER_ROLE = Object.freeze({ admin: "ADMIN", ftp: "FTP", net: "NET" });
const DATA_VERSION = Object.freeze({ devices: "devices", whitelist: "whitelist", users: "users" });

export { FILE_TYPE, CONNECTION_CTYPE, DEVICE_TYPE, USER_ROLE, DATA_VERSION };
