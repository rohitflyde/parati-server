import express from "express";
import cloudinarUpload from "../middleware/uploadMiddleware.js";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
} from "../controllers/category.controller.js";
import { protect, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllCategories); // List all categories
router.get("/:id", getCategoryById); // Get category by ID

// Admin-only routes to create, update, and delete category
router.post("/", cloudinarUpload.single("img"), createCategory);
router.put(
  "/:id",
  protect,
  isAdmin,
  cloudinarUpload.single("img"),
  updateCategory
);
router.delete("/:id", protect, isAdmin, deleteCategory);

export default router;
