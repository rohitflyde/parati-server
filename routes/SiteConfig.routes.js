import express from "express";
import { getSiteConfig, upsertSiteConfig } from "../controllers/SiteConfig.controller.js";
import cloudinarUpload from '../middleware/uploadMiddleware.js'
import { protect, isAdmin} from '../middleware/authMiddleware.js'

const router = express.Router();

router.get("/site-config", getSiteConfig);

router.post(
    "/site-config",
    protect,
    isAdmin,
    cloudinarUpload.any(),
    upsertSiteConfig
);

router.put(
    "/site-config",
    // protect,
    // isAdmin,
    cloudinarUpload.any(),
    upsertSiteConfig
);

export default router;
