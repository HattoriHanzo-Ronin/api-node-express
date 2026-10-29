
const DEVICE_TYPE = Object.freeze({ client: "CLIENT", router: "ROUTER", server: "SERVER" });
const USER_ROLE = Object.freeze({ admin: "ADMIN", ftp: "FTP", net: "NET" });
const FILE_TYPE = Object.freeze({ dir: "DIR", file: "FILE" });
const SOCKET_ENTITY = Object.freeze({ devices: "devices", whitelist: "whitelist", users: "users", ftp: "ftp" });
export { FILE_TYPE, DEVICE_TYPE, SOCKET_ENTITY, USER_ROLE };
