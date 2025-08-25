import Review from "../models/Review.js";
import Product from "../models/Product.js";
import Order from "../models/Order.js";
import mongoose from "mongoose";
import { createMediaEntry } from "../utils/createMediaEntry.js";

/**
 * Helper: update product average rating & total reviews
 */
const updateProductRating = async (productId) => {
    const stats = await Review.aggregate([
        { $match: { productId: new mongoose.Types.ObjectId(productId), status: "approved" } },
        {
            $group: {
                _id: "$productId",
                avgRating: { $avg: "$rating" },
                totalReviews: { $sum: 1 }
            }
        }
    ]);

    if (stats.length > 0) {
        await Product.findByIdAndUpdate(productId, {
            averageRating: stats[0].avgRating,
            totalReviews: stats[0].totalReviews
        });
    } else {
        // If no reviews left
        await Product.findByIdAndUpdate(productId, {
            averageRating: 0,
            totalReviews: 0
        });
    }
};

export const createReview = async (req, res) => {
    try {
        console.log(req.body)
        const { productId, variantId, rating, title, comment } = req.body;
        const userId = req.user._id;

        // 1. Check if user has purchased the product
        const purchased = await Order.exists({
            userId,
            "items.productId": productId,
            status: { $in: ["delivered", "completed"] }
        });

        // 2. Prevent duplicate review
        const existing = await Review.findOne({ productId, userId });
        if (existing) {
            return res.status(400).json({ message: "You have already reviewed this product" });
        }

        // 3. Handle photo uploads
        let photosIds = [];
        console.log(photosIds)
        if (req.files?.photos) {
            for (const file of req.files.photos) {
                const mediaId = await createMediaEntry(file, req.user._id); // uploadedBy = userId
        console.log(mediaId)
                photosIds.push(mediaId);
            }
        }

        console.log(photosIds)


        // 4. Create review
        const review = await Review.create({
            productId,
            userId,
            rating,
            title,
            comment,
            photos: photosIds,
            verifiedPurchase: !!purchased,
            attributes: {
                variantId: variantId || null
            }
        });

        // 5. Update product stats
        await updateProductRating(productId);

        res.status(201).json(review);
    } catch (err) {
        console.error("Create Review Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};



export const getProductReviews = async (req, res) => {
    try {
        const { productId } = req.params;
        const { variantId, page = 1, limit = 10, sort = "-createdAt" } = req.query;

        const filter = { productId, status: "approved" };
        if (variantId) filter["attributes.variantId"] = variantId;

        const reviews = await Review.find(filter)
            .populate("userId", "name avatar")
            .populate("photos")
            .sort(sort)
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Review.countDocuments(filter);

        res.json({
            reviews,
            pagination: {
                total,
                page: Number(page),
                pages: Math.ceil(total / limit)
            }
        });
    } catch (err) {
        console.error("Get Reviews Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


export const updateReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        if (review.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        const updates = ["rating", "title", "comment", "photos"];
        updates.forEach((field) => {
            if (req.body[field] !== undefined) {
                review[field] = req.body[field];
            }
        });

        await review.save();
        await updateProductRating(review.productId);

        res.json(review);
    } catch (err) {
        console.error("Update Review Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


export const deleteReview = async (req, res) => {
    try {
        const { id } = req.params;
        const review = await Review.findById(id);

        if (!review) {
            return res.status(404).json({ message: "Review not found" });
        }

        if (review.userId.toString() !== req.user._id.toString() && req.user.role !== "admin") {
            return res.status(403).json({ message: "Not authorized" });
        }

        await review.deleteOne();
        await updateProductRating(review.productId);

        res.json({ message: "Review deleted" });
    } catch (err) {
        console.error("Delete Review Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


export const markReviewHelpful = async (req, res) => {
    try {
        const { id } = req.params;
        await Review.findByIdAndUpdate(id, { $inc: { helpfulVotes: 1 } });
        res.json({ message: "Marked as helpful" });
    } catch (err) {
        console.error("Mark Helpful Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};


export const changeReviewStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!["pending", "approved", "rejected"].includes(status)) {
            return res.status(400).json({ message: "Invalid status" });
        }

        const review = await Review.findByIdAndUpdate(id, { status }, { new: true });
        await updateProductRating(review.productId);

        res.json(review);
    } catch (err) {
        console.error("Change Review Status Error:", err);
        res.status(500).json({ message: "Server error" });
    }
};
