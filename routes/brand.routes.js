import express from "express";
import {
    createBrand,
    getAllBrands,
    getBrandById,
    updateBrand,
    deleteBrand,
} from "../controllers/brand.controller.js";
import { protect, isAdmin } from "../middleware/authMiddleware.js";
import  cloudinaryUpload from '../middleware/uploadMiddleware.js'

const router = express.Router();

// Public Routes
router.get("/", getAllBrands);
router.get("/:id", getBrandById);

// Admin Routes (authentication & authorization required)
router.post("/", protect, isAdmin, cloudinaryUpload.single("logo"), createBrand);
router.put("/:id", protect, isAdmin, cloudinaryUpload.single("logo"), updateBrand);
router.delete("/:id", protect, isAdmin, deleteBrand);

export default router;
