import mongoose, { Schema } from "mongoose";

// Hero Slider Sub-schema
const heroSliderSchema = new Schema(
  {
    preTitle: String,
    title1: String,
    title2: String,
    sideTitle: String,
    slideUrl: String,
    bannerImageMobile: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
    bannerImageDesktop: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
    bannerImageThumbnail: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
    },
  },
  { _id: false }
);

// Feature Box Sub-schema
const featureBoxItemSchema = new Schema(
  {
    title: String,
    subtitle: String,
    buttonTextOne: String,
    buttonUrlOne: String,
    buttonTextTwo: String,
    buttonUrlTwo: String,
    image: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  },
  { _id: false }
);

const featureBoxesSchema = new Schema(
  {
    box1: featureBoxItemSchema,
    box2: featureBoxItemSchema,
    box3: featureBoxItemSchema,
  },
  { _id: false }
);

const categorySchema = new Schema(
  {
    title: { type: String, required: true, trim: true },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },

    description: { type: String, default: null },
    shortDescription: { type: String, default: null },

    img: { type: mongoose.Schema.Types.ObjectId, ref: "Media", default: null },

    status: { type: Boolean, required: true, default: true },

    metaTitle: { type: String, default: null },
    metaDescription: { type: String, default: null },

    heroSlider: [heroSliderSchema],

    featureBoxes: featureBoxesSchema,

    subCategories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "SubCategory",
      },
    ],

    // 👇 Added fields to match controllers
    parentCategoryId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Category",
      default: null,
    },

    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Product",
      },
    ],
  },
  { timestamps: true }
);

export default mongoose.model("Category", categorySchema);
