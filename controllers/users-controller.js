import ValidateUtils from "../utils/validate-utils.js";
import UsersSchema from "../schemas/users-schema.js";
import idSchema from "../schemas/id-schema.js";

/**
 * Controller for Users
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersController {
    constructor({ usersFacade }) {
        this.usersFacade = usersFacade;
    }

    getAll = async (req, res) => {
        res.json(await this.usersFacade.getAll({ authUser: req.user }));
    };

    getById = async (req, res) => {
        const { params, user: authUser } = req;
        const { id } = params;
        validateData({ id }, idSchema);
        res.json(await this.usersFacade.getById({ authUser, id }));
    };

    create = async (req, res) => {
        const user = validateData(req.body, getUsersSchema());
        res.status(201).json(await this.usersFacade.create({ authUser: req.user, user }));
    };

    update = async (req, res) => {
        const data = validateData(req.body, getPartialUserSchemaWithId());
        res.json(await this.usersFacade.update({ authUser: req.user, data }));
    };

    delete = async (req, res) => {
        const { params, user: authUser } = req;
        const { id } = params;
        validateData({ id }, idSchema);
        res.json(await this.usersFacade.delete({ authUser, id }));
    };
}

const { validateData } = ValidateUtils;
const { getUsersSchema, getPartialUserSchemaWithId } = UsersSchema;
