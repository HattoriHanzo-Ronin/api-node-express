/**
 * Handles server responses
 */
export default class Response {
    constructor({ res }) {
        this.res = res;
    }

    /**
     * Creates an error response
     *
     * @param err Error status
     * @param mess Error message
     * @returns Returns the response
     */
    notFound = (err = 404, mess = "Not Found") => this.res.status(err).send(`<h1 >${mess}</h1>`);

    /**
     * Creates a successful response.
     *
     * @param status Response status
     * @returns Returns the response
     */
    found = (status = 201) => this.res.status(status).end();
}
