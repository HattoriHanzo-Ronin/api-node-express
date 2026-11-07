import z from "zod";
import idSchema from "./common/id-schema.js";
import macSchema from "./common/mac-schema.js";

const ALLOWED_DEVICE_SCHEMA = z.object({ ...idSchema.shape, mac: macSchema.shape.mac });

export default ALLOWED_DEVICE_SCHEMA;
