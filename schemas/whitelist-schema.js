import z from "zod";
import idSchema from "./id-schema.js";
import DevicesSchema from "./devices-schema.js";

const { name, mac } = DevicesSchema.getBaseSchema().shape;
const allowedDeviceSchema = z.object({ id: idSchema.shape.id, name, mac });

export default allowedDeviceSchema;
