export const ENV = Object.freeze({
    port: Number(process.env.THUMBNAIL_GENERATOR_PORT),
    apiUrl: process.env.API_URL,
    thumbnailGeneratorUrl: process.env.THUMBNAIL_GENERATOR_URL
});
