import pg from 'pg-promise';

// configuracion para conectarse a la db
const config = {
    host: process.env.HOSTDB,
    port: process.env.PORTDB,
    user: process.env.USERDB,
    password: process.env.PASSDB,
    database: process.env.DB
},
    // conexion a la db
    db = pg()(config),
    // la funcionalidad de pg helper, ayudara con los insert y updates
    pghelper = pg().helpers,
    // columnas que usara, se puede mapear usando array o usando el propio objeto con Object.keys
    column = {
        net: new pghelper.ColumnSet(["pass", "wifipass"], { table: "net" }), device: new pghelper.ColumnSet(["id", "name", "mac", "intrface", "type", "ip"], { table: "device" }),
        whitelist: new pghelper.ColumnSet(["device_id", "allow_device_id", "key"], { table: "whitelist" })
    }

export class DeviceModel {

    /**
     * Hará el select correspondiente segun lo que se le pasa
     * 
     * @param intrface Filtrara por interfaz
     * @param passw Extraera el password 
     * @param whitelist Id del router o repetidor, se usará par hacer consultas en base a la tabla whitelist
     * @param white Id del dispositivo cliente, se usará para hacer consultas en base a la tabla whitelist
     * @param allow  Obtendra todos los dispositivos que esten permitidos en un filtro mac de un router o repetidor en concreto 
     * @param notAllow Hará lo mismo que arriba pero los que no están permitidos
     * @returns Devuelve el contenido de la consulta en cuestión si algo sale mal false
     */
    static async getAll({ intrface, allow, notAllow, whitelist, white, passw }) {
        try {
            if (intrface) return await db.any(`select ${column.device.names} from device where LOWER(intrface)=$1`, intrface.toLocaleLowerCase())

            if (passw) return await db.one(`select pass from net`)

            if (white && whitelist) return await db.one(`select key from whitelist where device_id = $1 and allow_device_id = $2`, [whitelist, white])

            if (whitelist) return await db.any(`select key from whitelist where device_id = $1`, whitelist)
   
            if (white) return await db.any(`select * from whitelist where allow_device_id = $1`, white)
 
            if (allow) return await db.any(`select ${column.device.names} from device d join whitelist w on w.allow_device_id = d.id where w.device_id = $1`, allow)
            
            if (notAllow) return await db.any(`select ${column.device.names} from device d 
                left join whitelist w on w.allow_device_id = d.id and w.device_id = $1
                 where w.allow_device_id is null and LOWER(d.intrface) = 'wifi'`, notAllow)


            // construira un objeto con el resultado de las 2 consultas, si existiera alguna red mas solo recogera los de 1 id en concreto
            const id = "net", [net, devices] = await Promise.all([db.one(`select ${column.net.names} from net where id=$1`, id), db.any(`select ${column.device.names} from device where net_id=$1`, id)]),
                result = { net: { ...net, devices: devices } }
            return result.net
        } catch {
            return false;
        }
    }

    /**
     * Buscará un dispositivo por su id
     * 
     * @param id Id del dispositivo
     * @returns Devolverá el dispositivo si se encuentra si algo sale mal false
     */
    static async getId({ id }) {
        try {
            const result = await db.one("select * from device where id=$1", id)
            return result
        } catch {
            return false;
        }
    }

    /**
     * Creará un nuevo dispositivo
     * 
     * @param input Dispositivo que se va a crear
     * @returns Devolverá true si todo sale bien o false si algo sale mal
     */
    static async create({ input }) {
        try {
            //  realizara una query con el objeto que se va a insertar y las columnas
            await db.none(pghelper.insert(input, column.device))
            //devolvera true
            return true
        } catch {
            return false;
        }
    }

    /**
     * Añadirá un dispositivo a la whitelist correspondiente
     * 
     * @param input Id del router o repetidor e id del dispositivo que se añade
     * @returns Devolverá true si todo sale bien o false si algo sale mal
     */
    static async addAllow({ input }) {
        try {
            await db.none(pghelper.insert(input, column.whitelist))
            return true
        } catch {
            return false
        }
    }

    /**
     * Eliminará un dispositivo a la whitelist correspondiente
     * 
     * @param input Id del router o repetidor e id del dispositivo que se elimina
     * @returns Devolverá true si todo sale bien o false si algo sale mal
     */
    static async delAllow({ id, allowId }) {
        try {
            // buscara por ambos id y eliminara
            await db.none('delete from whitelist where device_id = $1 and allow_device_id = $2', [id, allowId])
            return true
        } catch {
            return false;
        }
    }

    /**
     * Actulizará un dispositivo
     * 
     * @param id Id del dispositivo que se va a actualizar
     * @param input Datos que se van a actualizar
     * @returns Devolverá true si todo sale bien o false si algo sale mal
     */
    static async update({ id, input }) {
        try {
            //  realizara una query con el objeto que se va a actulizar y las columnas
            await db.none(pghelper.update({ id: id, ...input }, column.device) + " where id = $1", id)
            //devolvera true
            return true
        } catch {
            return false;
        }
    }

    /**
     * Eliminará un dispositivo
     * 
     * @param id Id del dispositivo que se va a eliminar
     * @returns Devolverá true si todo sale bien o false si algo sale mal
     */
    static async del({ id }) {
        try {
            // buscara por id y eliminara
            await db.none('delete from device where id = $1', id)
            return true
        } catch {
            return false;
        }
    }
}