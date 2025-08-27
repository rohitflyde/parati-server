import express from "express";
import cloudinarUpload from "../middleware/uploadMiddleware.js";
import {
  createCategory,
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
  checkCategorySlug,
  getCategoryBySlug
} from "../controllers/category.controller.js";
import { protect, isAdmin } from "../middleware/authMiddleware.js";

const router = express.Router();

// Public routes
router.get("/", getAllCategories); // List all categories
router.get("/check-slug", protect, isAdmin, checkCategorySlug);
router.get("/slug/:slug", getCategoryBySlug);

router.get("/:id", getCategoryById); // Get category by ID

// Admin-only routes to create, update, and delete category
router.post("/", protect, isAdmin, cloudinarUpload.single("img"), createCategory);
router.put(
  "/:id",
  protect,
  isAdmin,
  cloudinarUpload.single("img"),
  updateCategory
);
router.delete("/:id", protect, isAdmin, deleteCategory);

export default router;
