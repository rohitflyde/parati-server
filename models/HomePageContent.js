// models/Homepage.js
import mongoose from "mongoose";

const HeroProductSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        slug: { type: String, required: true },
        sku: { type: String },
        category: { type: String },

        highlights: [
            {
                label: { type: String },
                subLabel: { type: String },
                description: { type: String }
            }
        ],
        // Editable content fields
        brandTag: {
            type: String,
        },
        emiText: {
            type: String,
        },
        descriptionText: {
            type: String,
        },
        categoryLinkText: {
            type: String,
            default: "All {category}"
        },

        image: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Media",
            required: false
        },
        mrp: { type: Number, required: true },
        sp: { type: Number, required: true },
    },
    { timestamps: true }
);


const BannerSchema = new mongoose.Schema(
    {
        title: { type: String, required: true },
        subtitle: { type: String },
        description: { type: String },
        buttonText: { type: String, default: "Buy Now" },
        buttonLink: { type: String, default: "#" },

        // Pricing information
        originalPrice: { type: Number },
        discountedPrice: { type: Number },

        // Images
        mobileImage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Media",
            required: false
        },
        desktopImage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Media",
            required: false
        },

        // Styling options
        gradientOverlay: { type: String, default: "bg-gradient-to-b from-black/40 via-transparent to-pink-500/60" },
        textPosition: { type: String, default: "left" }, // left, right, center
        isActive: { type: Boolean, default: true },
        order: { type: Number, default: 0 }
    },
    { timestamps: true }
);

const HomepageSchema = new mongoose.Schema({
    hero: {
        latestLaunches: [HeroProductSchema],
    },
    banners: [BannerSchema],
    sectionOrder: { type: [String], default: [] }
});


export default mongoose.model("Homepage", HomepageSchema);