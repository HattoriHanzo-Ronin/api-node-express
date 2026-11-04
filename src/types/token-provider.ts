export type CreateTokenParams<Payload extends object> = {
    payload: Payload;
};

export type VerifyTokenParams = {
    token: string;
};
