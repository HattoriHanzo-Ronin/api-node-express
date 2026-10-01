import { Router } from "express";

export default function createThumbnailRouter({ thumbnailController }) {
    const router = Router();

    router.post("/:id", (req, res, next) => thumbnailController.create(req, res).catch(next));

    return router;
}
