import { Router } from "express"
import { DeviceController } from "../controllers/postgres/device.js"

export default function createNetRouter({ devModel }) {

    const netRouter = Router(), devController = new DeviceController({ devModel })
    
    netRouter.get("/", devController.getAll)

    netRouter.get("/:id", devController.getId)

    netRouter.post("/allow/:id", devController.addAllow)

    netRouter.post("/", devController.create)

    netRouter.patch("/:id", devController.update)
    
    netRouter.delete("/allow/:id/:allowId", devController.delAllow)

    netRouter.delete("/:id", devController.del)

    return netRouter
}