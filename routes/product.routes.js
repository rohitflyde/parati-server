import express from "express";
import {
  createProduct,
  getAllProducts,
  getProductBySlug,
  updateProduct,
  deleteProduct,
  getBulkProductsByIds,
  getProductsByCategorySlug,
  searchProducts,
  addAttributesToProduct,
  updateProductSpecifications,
} from "../controllers/product.controller.js";

import { protect, isAdmin } from "../middleware/authMiddleware.js";
import cloudinarUpload from "../middleware/uploadMiddleware.js";

const router = express.Router();

router.get("/", getAllProducts);
router.get("/search", searchProducts);

router.get("/slug/:slug", getProductBySlug);
router.get("/category/:slug/products", getProductsByCategorySlug);
router.post("/bulk", getBulkProductsByIds);

// Define all upload fields needed based on your schema embedded images/fields
const productImageFields = [
  { name: "featuredImage", maxCount: 1 },
  { name: "basePhotos", maxCount: 10 },
  { name: "banners.one.bannerImage", maxCount: 1 },
  { name: "banners.two.bannerImage", maxCount: 1 },
  { name: "banners.one.icon", maxCount: 1 },
  { name: "banners.two.icon", maxCount: 1 },
  { name: "featuredBanner.bannerImage", maxCount: 1 },
];

// CREATE PRODUCT
router.post(
  "/",
  protect,
  isAdmin,
  cloudinarUpload.fields(productImageFields),
  createProduct
);

// UPDATE PRODUCT
router.put(
  "/:id",
  protect,
  isAdmin,
  cloudinarUpload.fields(productImageFields),
  updateProduct
);

router.delete("/:id", protect, isAdmin, deleteProduct);
router.post("/:id/attributes", addAttributesToProduct);
router.post("/:productId/specifications", updateProductSpecifications);

export default router;
