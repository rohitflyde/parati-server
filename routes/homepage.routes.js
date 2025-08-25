// routes/homepage.routes.js
import express from "express";
import { isAdmin, protect } from '../middleware/authMiddleware.js'
import {
    getHeroProducts,
    addHeroProduct,
    updateHeroProduct,
    getBanners,
    addBanner,
    updateBanner,
    deleteBanner
} from "../controllers/homepage.controller.js";
import cloudinarUpload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Hero routes
router.get("/hero", getHeroProducts);
router.post("/hero", protect, isAdmin, cloudinarUpload.any(), addHeroProduct);
router.put("/hero/:productId", protect, isAdmin, cloudinarUpload.any(), updateHeroProduct);

// Banner routes
router.get("/banners", getBanners);
router.post("/banners", protect, isAdmin, cloudinarUpload.any(), addBanner);
router.put("/banners/:bannerId", protect, isAdmin, cloudinarUpload.any(), updateBanner);
router.delete("/banners/:bannerId", protect, isAdmin, deleteBanner);

export default router;