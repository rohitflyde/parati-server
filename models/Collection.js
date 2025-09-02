import mongoose, { Schema } from "mongoose";

const collectionSchema = new Schema(
    {
        // Basic Info
        name: {
            type: String,
            required: true,
            unique: true,
            trim: true
        },
        slug: {
            type: String,
            required: true,
            unique: true,
            lowercase: true,
            trim: true
        },

        // Display Info
        title: { type: String, required: true }, // Display title
        description: { type: String },
        shortDescription: { type: String },

        // Images
        featuredImage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Media"
        },
        bannerImage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Media"
        },
        thumbnailImage: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Media"
        },

        // Collection Type & Settings
        collectionType: {
            type: String,
            enum: ["festival", "occasion", "seasonal", "category", "promotion", "brand_special"],
            default: "festival"
        },

        // Dates (for seasonal/festival collections)
        startDate: { type: Date },
        endDate: { type: Date },

        // Display Settings
        displayOrder: { type: Number, default: 0 },
        showOnHomepage: { type: Boolean, default: false },
        showInNavigation: { type: Boolean, default: true },
        isActive: { type: Boolean, default: true },

        // Marketing Content
        marketing: {
            heroTitle: String,
            heroSubtitle: String,
            seoTitle: String,
            seoDescription: String,
            metaTags: [String],
            callToAction: {
                text: String,
                url: String,
                style: {
                    type: String,
                    enum: ["primary", "secondary", "outline"],
                    default: "primary"
                }
            }
        },

        // Styling (for frontend customization)
        styling: {
            backgroundColor: String,
            textColor: String,
            accentColor: String,
            backgroundPattern: String, // CSS class or pattern name
            customCSS: String
        },

        // Analytics & Performance
        viewCount: { type: Number, default: 0 },
        clickCount: { type: Number, default: 0 },

        // Admin Info
        createdBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
        lastUpdatedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User"
        },
    },
    {
        timestamps: true,
        toJSON: { virtuals: true },
        toObject: { virtuals: true }
    }
);

// Virtual for product count
collectionSchema.virtual('productCount', {
    ref: 'Product',
    localField: '_id',
    foreignField: 'collections',
    count: true
});

// Indexes
collectionSchema.index({ slug: 1 });
collectionSchema.index({ isActive: 1, displayOrder: 1 });
collectionSchema.index({ collectionType: 1, isActive: 1 });
collectionSchema.index({ startDate: 1, endDate: 1 });
collectionSchema.index({ showOnHomepage: 1, isActive: 1 });

// Text search
collectionSchema.index({
    name: "text",
    title: "text",
    description: "text",
    shortDescription: "text"
});

// Pre-save middleware for slug generation
collectionSchema.pre('save', function (next) {
    if (this.isModified('name') && !this.slug) {
        this.slug = this.name
            .toLowerCase()
            .replace(/[^a-z0-9]/g, '-')
            .replace(/-+/g, '-')
            .replace(/^-|-$/g, '');
    }
    next();
});

// Methods
collectionSchema.methods.isCurrentlyActive = function () {
    if (!this.isActive) return false;

    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;

    return true;
};

// Static methods
collectionSchema.statics.getActiveCollections = function () {
    const now = new Date();
    return this.find({
        isActive: true,
        $or: [
            { startDate: { $exists: false } },
            { startDate: { $lte: now } }
        ],
        $or: [
            { endDate: { $exists: false } },
            { endDate: { $gte: now } }
        ]
    }).sort({ displayOrder: 1, createdAt: -1 });
};

collectionSchema.statics.getFestivalCollections = function () {
    return this.find({
        collectionType: 'festival',
        isActive: true
    }).sort({ startDate: 1, displayOrder: 1 });
};

export default mongoose.model("Collection", collectionSchema);