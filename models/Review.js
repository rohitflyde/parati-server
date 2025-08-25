import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema({
    productId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
        required: true,
        index: true
    },
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    title: {
        type: String,
        trim: true,
        maxlength: 100
    },
    comment: {
        type: String,
        trim: true,
        maxlength: 1000
    },
    photos: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media"
    }],
    verifiedPurchase: {
        type: Boolean,
        default: false
    },
    helpfulVotes: {
        type: Number,
        default: 0
    },
    attributes: {
        // Optional variant info if available
        variantId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Variant"
        },
        variantName: String // e.g. "Blue, Large"
    },
    status: {
        type: String,
        enum: ["pending", "approved", "rejected"],
        default: "approved"
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Prevent duplicate reviews from same user for same product
reviewSchema.index({ productId: 1, userId: 1 }, { unique: true });

// Add text index for search
reviewSchema.index({ title: "text", comment: "text" });

// reviewSchema.pre("save", async function (next) {
//     const Order = mongoose.model("Order");
//     const hasPurchased = await Order.exists({
//         userId: this.userId,
//         "items.productId": this.productId,
//         status: { $in: ["delivered", "completed"] }
//     });
//     this.verifiedPurchase = !!hasPurchased;
//     next();
// });


const Review = mongoose.model("Review", reviewSchema);
export default Review;