import mongoose, { Schema } from "mongoose";

// --- 1. Embedded Sub-schemas --- //

// Shipping
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

// Banner (for marketing/promos)
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

// Influencer Video content
const influencerVideoSchema = new Schema(
  {
    showSection: { type: Boolean, default: true },
    videos: [{ type: String }],
  },
  { _id: false }
);

// Featured Banner content
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

// Compare Features (Flexible, Optional)
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

// --- 2. Main Product Model --- //

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
    productLineId: { type: mongoose.Schema.Types.ObjectId, ref: "ProductLine" }, // optional

    categories: [{ type: mongoose.Schema.Types.ObjectId, ref: "Category" }],

    tagIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Tag" }],

    shortDescription: { type: String },
    longDescription: { type: String },

    basePrice: { type: Number, required: true },
    salePrice: { type: Number }, // optional special price

    basePhotos: [{ type: mongoose.Schema.Types.ObjectId, ref: "Media" }],
    featuredImage: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },

    // baseFeatures: { type: Map, of: mongoose.Schema.Types.ObjectId },
    // baseFeatures: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Feature",
    //     required: false,
    //   },
    // ],

    attributes: [attributeSchema],
    shipping: shippingSchema,

    // Inventory & Variants
    inventoryType: {
      type: String,
      enum: ["simple", "with_variants"],
      default: "simple",
    },
    sku: { type: String, unique: true }, // only for 'simple' inventory
    stock: { type: Number, default: 0 }, // for 'simple'
    variants: [{ type: mongoose.Schema.Types.ObjectId, ref: "Variant" }], // only used for 'with_variants'

    // Product Relations (upsell, FBT, related, etc.)
    fbtIds: [{ type: mongoose.Schema.Types.ObjectId, ref: "Product" }], // frequently bought together
    relatedProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],
    checkoutUpsellProductIds: [
      { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
    ],

    // Marketplace Links (optional)
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

    // Marketing Fields (OPTIONAL - embedded)
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

    // Comparison (OPTIONAL)
    compareSection: compareSectionSchema,

    // SEO
    metaTitle: String,
    metaDescription: String,

    specifications: [
      {
        section: { type: String, required: true }, // e.g., "General", "Display"
        specs: [
          {
            key: { type: String, required: true }, // e.g., "Brand"
            value: { type: String, required: true }, // e.g., "Samsung"
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

productSchema.index({
  name: "text",
  slug: "text",
  shortDescription: "text",
  longDescription: "text",
});

export default mongoose.model("Product", productSchema);
