import express from "express";
import {
  createAttribute,
  createAttributeValue,
  getAttributesWithValues,
} from "../controllers/attribute.controller.js";
import { protect, isAdmin } from "../middleware/authMiddleware.js";
import cloudinaryUpload from "../middleware/uploadMiddleware.js";

const router = express.Router();

// Admin Routes
// router.post('/', protect, isAdmin, createAttribute);
router.post("/", createAttribute);

router.post(
  "/values",
  cloudinaryUpload.single("thumbnail"),
  createAttributeValue
);

// Public Routes
router.get("/", getAttributesWithValues);

export default router;
