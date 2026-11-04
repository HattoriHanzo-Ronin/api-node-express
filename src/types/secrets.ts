export type Secret = Readonly<{
    passDb: string;
    jwtSecret: string;
    refreshJwtSecret: string;
    sftpKey: string;
}>;
