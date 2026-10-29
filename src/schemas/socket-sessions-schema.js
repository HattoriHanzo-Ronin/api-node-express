import z from "zod";
import { SOCKET_ENTITY } from "../config/constants.js";
import ValidateUtils from "../utils/validate-utils.js";

const { ERROR_MESSAGES: { typeRequired, invalidEnum } } = ValidateUtils;
const SOCKET_ENTITIES = Object.values(SOCKET_ENTITY);
const ENTITY = z.enum(SOCKET_ENTITIES, invalidEnum(SOCKET_ENTITIES));
const socketSubscriptionSchema = z.object({ entities: z.array(ENTITY, typeRequired).min(1) });

export { socketSubscriptionSchema };
