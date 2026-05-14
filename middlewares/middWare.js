import express from "express"
import cors from "cors"
import multer from "multer"

// maneja las cors de forma automatica 
export const corsMidd = (acceptOrigins) => cors(
    {
        origin: (origin, callback) => {
            if (acceptOrigins) {
                // aqui se aceptarian las url que se quiera 
                if (acceptOrigins.includes(origin)) return callback(null, true)
                return callback(new Error("No permitido"))
            }
            // por defecto aceptara cualquiera
            return callback(null, true)
        }
    }
),
    // servirá para formatear bien los objetos a json
    jsonMidd = () => express.json(),
    // actua cuando se recibe un archivo
    mult = () => multer({ storage: multer.memoryStorage() })
