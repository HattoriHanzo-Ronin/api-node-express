import z from "zod";
import idSchema from "./common/id-schema.js";
import macSchema from "./common/mac-schema.js";

const allowedDeviceSchema = z.object({ ...idSchema.shape, mac: macSchema.shape.mac });

export default allowedDeviceSchema;
