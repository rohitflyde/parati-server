import mongoose, { Schema } from "mongoose";

// --- 1. Embedded Sub-schemas (same as before) --- //

const shippingSchema = new Schema(
  {
    weight: { type: Number, default: null },
    dimensions: {
      length: { type: Number, default: null },
      width: { type: Number, default: null },
      height: { type: Number, default: null },
    },
    volumetricWeight: { type: Number, default: null },
    hazardous: { type: Boolean, default: false },
  },
  { _id: false }
);

const bannerSchema = new Schema(
  {
    showSection: { type: Boolean, default: true },
    position: {
      type: String,
      enum: ["left", "right", "center", "top", "bottom"],
      default: "right",
    },
    preTitle: String,
    title: String,
    subTitle: String,
    shadowText: String,
    description: String,
    buttonName: String,
    buttonUrl: String,
    bannerImage: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
    icon: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  },
  { _id: false }
);

const influencerVideoSchema = new Schema(
  {
    showSection: { type: Boolean, default: true },
    videos: [{ type: String }],
  },
  { _id: false }
);

const featuredBannerSchema = new Schema(
  {
    showSection: { type: Boolean, default: true },
    preTitle: String,
    title: String,
    videoUrl: String,
    buttonName: String,
    buttonUrl: String,
    bannerImage: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  },
  { _id: false }
);

const featureCompareDetailSchema = new Schema(
  {
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
    },
    featurePresent: { type: Boolean, required: true },
    description: { type: String, required: true },
  },
  { _id: false }
);

const compareFeatureSchema = new Schema(
  {
    featureId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Feature",
      required: true,
    },
    details: [featureCompareDetailSchema],
  },
  { _id: false }
);

const compareSectionSchema = new Schema(
  {
    showSection: { type: Boolean, default: true },
    title: String,
    description: String,
    selectedProducts: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    features: [compareFeatureSchema],
  },
  { _id: false }
);

const attributeSchema = new Schema({
  attributeId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Attribute",
  },
  attributeValues: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AttributeValue",
    },
  ],
});

// --- 2. Updated Product Model with Collections --- //

const productSchema = new Schema(
  {
    // Core
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },

    brandId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Brand",
      required: true,
    },
    productLineId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductLine" },

    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    // NEW: Collections Support
    collections: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Collection"
    }],

    tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],

    shortDescription: { type: String },
    longDescription: { type: String },

    basePrice: { type: Number, required: true },
    salePrice: { type: Number },

    basePhotos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    featuredImage: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },

    attributes: [attributeSchema],
    shipping: shippingSchema,

    // Inventory & Variants
    inventoryType: {
      type: String,
      enum: ["simple", "with_variants"],
      default: "simple",
    },
    sku: { type: String, unique: true },
    stock: { type: Number, default: 0 },
    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }],

    // Product Relations
    fbtIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }],
    relatedProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    checkoutUpsellProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],

    // Marketplace Links
    amazonLink: String,
    flipkartLink: String,
    ecommerce: { type: Boolean, default: false },

    // Stock and status
    status: { type: Boolean, default: true },
    stockStatus: {
      type: String,
      enum: ["in_stock", "out_of_stock"],
      default: "in_stock",
    },

    // Marketing Fields
    banners: {
      one: bannerSchema,
      two: bannerSchema,
    },
    influencerVideo: influencerVideoSchema,
    featuredBanner: featuredBannerSchema,
    defaultVariant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Variant",
    },

    // Comparison
    compareSection: compareSectionSchema,

    // SEO
    metaTitle: String,
    metaDescription: String,

    specifications: [
      {
        section: { type: String, required: true },
        specs: [
          {
            key: { type: String, required: true },
            value: { type: String, required: true },
          },
        ],
      },
    ],

    // NEW: Collection-specific data
    collectionData: [{
      collectionId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Collection"
      },
      featuredInCollection: { type: Boolean, default: false },
      collectionDisplayOrder: { type: Number, default: 0 },
      collectionSpecificPrice: { type: Number }, // Special price for collection
      collectionSpecificImages: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media"
      }],
      addedToCollectionAt: { type: Date, default: Date.now }
    }],
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

// Existing indexes
productSchema.index({
  name: "text",
  slug: "text",
  shortDescription: "text",
  longDescription: "text",
});

// NEW: Collection-related indexes
productSchema.index({ collections: 1, status: 1 });
productSchema.index({ "collectionData.collectionId": 1, "collectionData.featuredInCollection": 1 });

// NEW: Methods for collection management
productSchema.methods.addToCollection = function (collectionId, options = {}) {
  const existingIndex = this.collections.findIndex(
    id => id.toString() === collectionId.toString()
  );

  if (existingIndex === -1) {
    this.collections.push(collectionId);

    this.collectionData.push({
      collectionId,
      featuredInCollection: options.featured || false,
      collectionDisplayOrder: options.displayOrder || 0,
      collectionSpecificPrice: options.specialPrice || null,
      collectionSpecificImages: options.specialImages || []
    });
  }

  return this.save();
};

productSchema.methods.removeFromCollection = function (collectionId) {
  this.collections = this.collections.filter(
    id => id.toString() !== collectionId.toString()
  );

  this.collectionData = this.collectionData.filter(
    data => data.collectionId.toString() !== collectionId.toString()
  );

  return this.save();
};

productSchema.methods.getCollectionSpecificData = function (collectionId) {
  return this.collectionData.find(
    data => data.collectionId.toString() === collectionId.toString()
  );
};

// Static methods for collection queries
productSchema.statics.getByCollection = function (collectionId, options = {}) {
  const query = {
    collections: collectionId,
    status: true,
    stockStatus: "in_stock"
  };

  return this.find(query)
    .populate(options.populate || "brandId categories featuredImage basePhotos collections")
    .sort(options.sort || { "collectionData.collectionDisplayOrder": 1, createdAt: -1 })
    .limit(options.limit || 50);
};

productSchema.statics.getFeaturedByCollection = function (collectionId, limit = 10) {
  return this.find({
    collections: collectionId,
    "collectionData.featuredInCollection": true,
    status: true,
    stockStatus: "in_stock"
  })
    .populate("brandId categories featuredImage basePhotos collections")
    .sort({ "collectionData.collectionDisplayOrder": 1 })
    .limit(limit);
};

export default mongoose.model("Product", productSchema);