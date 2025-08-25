import mongoose, { Schema } from "mongoose";

// Schema for Hero Slider
const heroSliderSchema = new Schema({
  preTitle: { type: String },
  title1: { type: String },
  title2: { type: String },
  sideTitle: { type: String },
  slideUrl: { type: String },
  bannerImageMobile: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  bannerImageDesktop: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  bannerImageThumbnail: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
});

const featureBoxesSchema = new Schema({
  box1: {
    title: { type: String },
    subtitle: { type: String },
    buttonTextOne: { type: String },
    buttonUrlOne: { type: String },
    buttonTextTwo: { type: String },
    buttonUrlTwo: { type: String },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  },
  box2: {
    title: { type: String },
    subtitle: { type: String },
    buttonTextOne: { type: String },
    buttonUrlOne: { type: String },
    buttonTextTwo: { type: String },
    buttonUrlTwo: { type: String },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  },
  box3: {
    title: { type: String },
    subtitle: { type: String },
    buttonTextOne: { type: String },
    buttonUrlOne: { type: String },
    buttonTextTwo: { type: String },
    buttonUrlTwo: { type: String },
    image: { type: mongoose.Schema.Types.ObjectId, ref: "Media" },
  },
});

// Define the user schema
const schema = new Schema({
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Category",
    required: true,
  },
  title: { type: String, required: true },
  slug: { type: String, unique: true, required: true },
  description: { type: String, required: false, allowNull: true },
  shortDescription: { type: String, required: false, allowNull: true },
  img: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Media",
    required: false,
    allowNull: true,
  },
  status: { type: Boolean, required: true },
  metaTitle: { type: String, required: false, allowNull: true },
  metaDescription: { type: String, required: false, allowNull: true },
  // heroSlider: {
  //     slides: [{ type: heroSliderSchema }],
  //     showSection: { type: Boolean, required: true, default: true }
  // },
  // featureBoxes: {
  //     boxes: { type: featureBoxesSchema },
  //     showSection: { type: Boolean, required: true, default: true }
  // },
  createdAt: { type: Date, required: true, default: Date.now },
  updatedAt: { type: Date, required: true, default: Date.now },
});

schema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

const Subcategory = mongoose.model("Subcategory", schema);
export default Subcategory;
