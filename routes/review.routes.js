import express from "express";
import {
    createReview,
    getProductReviews,
    updateReview,
    deleteReview,
    markReviewHelpful,
    changeReviewStatus
} from "../controllers/review.controller.js";
import { protect, isAdmin } from "../middleware/authMiddleware.js";
import cloudinarUpload from "../middleware/uploadMiddleware.js";

const router = express.Router();

/**
 * Public Routes
 */
router.get("/:productId", getProductReviews); // Get reviews for a product

/**
 * Private (Customer) Routes
 */
router.post("/", protect, cloudinarUpload.array('photos'), createReview); // Create review
router.put("/:id", protect, updateReview); // Update own review
router.delete("/:id", protect, deleteReview); // Delete own review
router.patch("/:id/helpful", protect, markReviewHelpful); // Mark review helpful

/**
 * Admin Routes
 */
router.patch("/:id/status", protect, isAdmin, changeReviewStatus); // Approve / Reject

export default router;
