const ENV = Object.freeze({
    port: Number(process.env.PORT),
    apiUrl: process.env.API_URL,
    thumbnailGeneratorUrl: process.env.THUMBNAIL_GENERATOR_URL,
    dbHost: process.env.HOSTDB,
    dbPort: Number(process.env.PORTDB),
    dbUser: process.env.USERDB,
    dbName: process.env.DB,
    ftpHost: process.env.HOSTFTP,
    ftpPort: Number(process.env.PORTFTP),
    ftpMaxConnections: Number(process.env.FTP_MAX_CONNECTIONS) || 100,
    ftpMaxTransfers: Number(process.env.FTP_MAX_TRANSFERS) || 16,
    ftpIdleTimeout: Number(process.env.FTP_IDLE_TIMEOUT) || 15 * 60 * 1000,
    ftpScaleWait: Number(process.env.FTP_SCALE_WAIT) || 5000,
    ftpProtectedUsers: process.env.FTP_PROTECTED_USERS ?? "",
    chromePath: process.env.CHROME_PATH
});

export { ENV };
