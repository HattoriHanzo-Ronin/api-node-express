/**
 * Controla las respuestas del servidor
 */
export default class Response {
    constructor({ res }) {
        this.res = res
    }

    /**
     * Servirá para crear una respuesta de error
     * 
     * @param err Status del error
     * @param mess Mensaje para el error
     * @returns Devuelve la respuesta
     */
    notFound = (err = 404, mess = "Not Found") => this.res.status(err).send(`<h1 >${mess}</h1>`)

    /**
     * Servirá para crear una respuesta satisfactoria
     * 
     * @param status Estado de la repsuesta
     * @returns Devuelve la respuesta
     */
    found = (status = 201) => this.res.status(status).end()
}