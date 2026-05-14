/**
 * Valida los datos que se envian
 */
export default class Validate {
    constructor({ input }) {
        this.input = input
    }

    /**
     * Borra propiedades vacías
     * 
     */
    deleteEmpty = () => {
        Object.keys(this.input).forEach(key => {

            if (this.input[key] === "") {
                delete this.input[key];
            }
            
        })
    }

    /**
     * Controla las validaciones
     * 
     * @param schema Esquema con el que se va a comparar
     * @param op Si se quiere comprobar de forma parcial o completa
     * @returns Devolverá el resultado de la validación
     */
    validateData = (schema, op = "total") => {
        this.deleteEmpty()
        return op === "total" ?
            schema.safeParse(this.input) : schema.partial().safeParse(this.input)
    }
}