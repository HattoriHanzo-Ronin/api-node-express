import type {
    ChangeUserPasswordHandler,
    CreateUserHandler,
    DeleteUserHandler,
    GetAllUsersHandler,
    GetUserByIdHandler,
    UpdateUserHandler,
    UsersControllerDependencies
} from "../types/users-controller.js";
import ZodUtils from "../utils/zod-utils.js";
import UsersSchema from "../schemas/users-schema.js";
import idSchema from "../schemas/common/id-schema.js";

/**
 * Users controller
 *
 * @author HattoriHanzo-Ronin
 */
export default class UsersController {
    private readonly usersFacade: UsersControllerDependencies["usersFacade"];

    constructor({ usersFacade }: UsersControllerDependencies) {
        this.usersFacade = usersFacade;
    }

    getAll: GetAllUsersHandler = async (req, res) => {
        const { version, data } = await this.usersFacade.getAll({ authUser: req.user });
        res.set("Data-Version", version).json(data);
    };

    getById: GetUserByIdHandler = async (req, res) => {
        const { params, user: authUser } = req;
        const { id } = ZodUtils.validateData(params, idSchema);
        res.json(await this.usersFacade.getById({ authUser, id }));
    };

    create: CreateUserHandler = async (req, res) => {
        const user = ZodUtils.validateData(req.body, UsersSchema.getValidatedSchema());
        res.status(201).json(await this.usersFacade.create({ authUser: req.user, user }));
    };

    update: UpdateUserHandler = async (req, res) => {
        const data = ZodUtils.validateData(req.body, UsersSchema.getPartialSchema());
        res.json(await this.usersFacade.update({ authUser: req.user, data }));
    };

    changePassword: ChangeUserPasswordHandler = async (req, res) => {
        const data = ZodUtils.validateData(req.body, UsersSchema.getChangePasswordSchema());
        await this.usersFacade.changePassword({ authUser: req.user, ...data });
        res.status(200).end();
    };

    delete: DeleteUserHandler = async (req, res) => {
        const { params, user: authUser } = req;
        const { id } = ZodUtils.validateData(params, idSchema);
        res.json(await this.usersFacade.delete({ authUser, id }));
    };
}
