const ENV = Object.freeze({
    port: Number(process.env.PORT),
    dbHost: process.env.HOSTDB,
    dbPort: Number(process.env.PORTDB),
    dbUser: process.env.USERDB,
    dbName: process.env.DB,
    ftpHost: process.env.HOSTFTP,
    ftpPort: Number(process.env.PORTFTP),
    chromePath: process.env.CHROME_PATH
});

export { ENV };
