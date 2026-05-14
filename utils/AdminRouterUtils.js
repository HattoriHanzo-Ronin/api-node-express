import { wrapper } from "axios-cookiejar-support";
import { CookieJar } from "tough-cookie";
import axios from "axios";

/**
 * Administra las operaciones con el filtrado mac de RepPasillo
 */
export default class AdminRepPasillo {
    constructor({ dev, passw }) {
        this.dev = dev
        this.passw = passw
    }

    // crea un objeto axio con cookies
    getClient = () => {
        const cookies = new CookieJar()
        return wrapper(axios.create({
            cookies,
            withCredentials: true
        }))
    }

    // fabrica la url usando la ip
    getUrl = (ip) => `http://${ip}`

    // funcion de "encriptacion" del password
    loginRepPas = async (client, url) => {

        function securityEncode(a, b, c) {
            let e = "";
            let g = a.length;
            let h = b.length;
            let k = c.length;
            let f = g > h ? g : h;

            for (let p = 0; p < f; p++) {
                let l = 187;
                let n = 187;

                if (p >= g) n = b.charCodeAt(p);
                else if (p >= h) l = a.charCodeAt(p);
                else {
                    l = a.charCodeAt(p);
                    n = b.charCodeAt(p);
                }

                e += c.charAt((l ^ n) % k);
            }

            return e;
        }

        // función de "encriptacion" del password
        function orgAuthPwd(password) {
            const key = "RDpbLfCPsJZ7fiv";
            const dict = "yLwVl0zKqws7LgKPRQ84Mdt708T1qQ3Ha7xv3H7NyU84p21BriUWBU43odz3iP4rBL3cD02KZciXTys" +
                "VXiV8ngg6vL48rPJyAUw0HurW20xqxv9aYb4M9wK1Ae0wlro510qXeU07kV57fQMc8L6aLgMLwygtc0F10a0Dg70TOoou" +
                "yFhdysuRMO51yY5ZlOZZLEal1h0t9YQW0Ko7oBwmCAHoic4HYbUyVeU3sfQ1xtXcPcf1aT303wAQhv66qzW";

            return securityEncode(key, password, dict);
        }

        // servira para autenticarse en el repetidor
        const login = await client.post(url, {
            login: {
                password: orgAuthPwd(this.passw)
            },
            method: "do"
        }, {
            headers: {
                "Content-Type": "application/json"
            }
        });

        return login.data.stok
    }

    /**
     * Genera una nueva key
     * @param keys Lista de keys actuales
     * @returns Devuelve una nueva key
     */
    getKey = async (keys) => {
        let num = ""

        keys.sort((a, b) => {
            const aK = Number(a.key.split("_").pop()), bK = Number(b.key.split("_").pop())
            return aK - bK
        })

        for (let ind = 0; ind < keys.length; ind++) {
            num = Number(keys[ind].key.split("_").pop())
            if (num - ind > 1) return num - 1
        }

        return num + 1
    }


    // ejecutara los metodos de insertado, actulización o borrado
    postOnRouter = async (data) => {
        try {
            const client = this.getClient(), url = this.getUrl(this.dev.ip), sesion = await this.loginRepPas(client, url)

            await client.post(url + `/stok=${sesion}/ds`, data, {
                headers: { "Content-Type": "application/json" }
            })

            return true
        } catch {
            return false;
        }
    }

    /**
     * Añade una mac en RepPasillo
     * 
     * @param input Dispositivo que se va añadir
     * @returns Devuelve true si todo salió bien o false si algo sale mal
     */
    addAllow = async ({ input }) => {
        return await this.postOnRouter({
            method: "add",
            wlan_access: {
                name: input.key,
                para: {
                    mac: input.dev.mac.replaceAll(":", "-"),
                    name: input.dev.name
                },
                table: "white_list"
            }
        }
        )
    }

    /**
     * Borra una mac en RepPasillo
     * 
     * @param key La key del dispositivo a eliminar
     * @returns Devuelve true si todo salió bien o false si algo sale mal
     */
    delAllow = async (key) => {
        return await this.postOnRouter({
            "method": "delete",
            "wlan_access": {
                "name": [
                    key
                ]
            }
        })
    }

    /**
     * Editará un dispositivo que se encuentra añadido
     * 
     * @param input Dispositivo que se va a actualizar
     * @returns Devuelve true si todo salió bien o false si algo sale mal
     */
    updateAllow = async ({ input }) => {
        return await this.postOnRouter({
            "method": "set",
            "wlan_access": {
                [input.key]: {
                    "mac": input.dev.mac.replaceAll(":", "-"),
                    "name": input.dev.name
                }
            }
        })
    }
}