import z from "zod";
import idSchema from "./id-schema.js";
import macSchema from "./mac-schema.js";

const allowedDeviceSchema = z.object({ ...idSchema.shape, mac: macSchema.shape.mac });

export default allowedDeviceSchema;
