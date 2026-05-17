import pg from "pg-promise";

const config = {
    host: process.env.HOSTDB,
    port: process.env.PORTDB,
    user: process.env.USERDB,
    password: process.env.PASSDB,
    database: process.env.DB
};
const db = pg()(config);
const pghelper = pg().helpers;
const column = {
    net: new pghelper.ColumnSet(["pass", "wifipass"], { table: "net" }),
    device: new pghelper.ColumnSet(["id", "name", "mac", "intrface", "type", "ip"], { table: "device" }),
    whitelist: new pghelper.ColumnSet(["device_id", "allow_device_id", "key"], { table: "whitelist" })
};

/**
 * Model for Devices
 *
 * @author HattoriHanzo-Ronin
 */
export class DeviceModel {
    /**
     * Performs the corresponding select query based on the provided parameters
     *
     * @param intrface Filters by interface
     * @param passw Retrieves the password
     * @param whitelist Router or repeater ID, used to perform queries based on the whitelist table
     * @param white Client device ID, used to perform queries based on the whitelist table
     * @param allow Retrieves all devices allowed in the MAC filter of a specific router or repeater
     * @param notAllow Retrieves all devices not allowed in the MAC filter of a specific router or repeater
     * @returns Returns the query result if everything goes well, otherwise false
     */
    static async getAll({ intrface, allow, notAllow, whitelist, white, passw }) {
        try {
            if (intrface)
                return await db.any(
                    `select ${column.device.names} from device where LOWER(intrface)=$1`,
                    intrface.toLocaleLowerCase()
                );

            if (passw) return await db.one(`select pass from net`);

            if (white && whitelist)
                return await db.one(`select key from whitelist where device_id = $1 and allow_device_id = $2`, [
                    whitelist,
                    white
                ]);

            if (whitelist) return await db.any(`select key from whitelist where device_id = $1`, whitelist);

            if (white) return await db.any(`select * from whitelist where allow_device_id = $1`, white);

            if (allow)
                return await db.any(
                    `select ${column.device.names} from device d join whitelist w on w.allow_device_id = d.id where w.device_id = $1`,
                    allow
                );

            if (notAllow)
                return await db.any(
                    `select ${column.device.names} from device d 
                left join whitelist w on w.allow_device_id = d.id and w.device_id = $1
                 where w.allow_device_id is null and LOWER(d.intrface) = 'wifi'`,
                    notAllow
                );

            const id = "net";
            const [net, devices] = await Promise.all([
                db.one(`select ${column.net.names} from net where id=$1`, id),
                db.any(`select ${column.device.names} from device where net_id=$1`, id)
            ]);
            const result = { net: { ...net, devices: devices } };
            return result.net;
        } catch {
            return false;
        }
    }

    /**
     * Searches for a device by its ID
     *
     * @param id Device ID
     * @returns Returns the device if found, otherwise false
     */
    static async getId({ id }) {
        try {
            const result = await db.one("select * from device where id=$1", id);
            return result;
        } catch {
            return false;
        }
    }

    /**
     * Creates a new device
     *
     * @param input Device to create
     * @returns Returns true if everything goes well, otherwise false
     */
    static async create({ input }) {
        try {
            await db.none(pghelper.insert(input, column.device));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Adds a device to the corresponding whitelist
     *
     * @param input Router or repeater ID and device ID to add
     * @returns Returns true if everything goes well, otherwise false
     */
    static async addAllow({ input }) {
        try {
            await db.none(pghelper.insert(input, column.whitelist));
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Removes a device from the corresponding whitelist
     *
     * @param input Router or repeater ID and device ID to remove
     * @returns Returns true if everything goes well, otherwise false
     */
    static async delAllow({ id, allowId }) {
        try {
            await db.none("delete from whitelist where device_id = $1 and allow_device_id = $2", [id, allowId]);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Updates a device
     *
     * @param id Device ID to update
     * @param input Data to update
     * @returns Returns true if everything goes well, otherwise false
     */
    static async update({ id, input }) {
        try {
            await db.none(pghelper.update({ id: id, ...input }, column.device) + " where id = $1", id);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Deletes a device
     *
     * @param id Device ID to delete
     * @returns Returns true if everything goes well, otherwise false
     */
    static async del({ id }) {
        try {
            await db.none("delete from device where id = $1", id);
            return true;
        } catch {
            return false;
        }
    }
}
