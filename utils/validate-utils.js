/**
 * Validates the submitted data
 *
 * @author HattoriHanzo-Ronin
 */
export default class Validate {
    constructor({ input }) {
        this.input = input;
    }

    /**
     * Removes empty properties
     *
     */
    deleteEmpty = () => {
        Object.keys(this.input).forEach((key) => {
            if (this.input[key] === "") {
                delete this.input[key];
            }
        });
    };

    /**
     * Handles validations
     *
     * @param schema Schema used for validation
     * @param op Indicates whether validation should be partial or complete
     * @returns Returns the validation result
     */
    validateData = (schema, op = "total") => {
        this.deleteEmpty();
        return op === "total" ? schema.safeParse(this.input) : schema.partial().safeParse(this.input);
    };
}
