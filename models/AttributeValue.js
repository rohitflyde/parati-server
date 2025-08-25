import mongoose from "mongoose";
import slugify from "slugify";

const attributeValueSchema = new mongoose.Schema(
  {
    // Core Fields
    attribute_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Attribute",
      required: true,
      index: true,
    },
    label: {
      type: String,
      required: [true, "Label is required"],
      trim: true,
    },
    value: {
      type: String,
      required: [true, "Value is required"],
      trim: true,
    },
    slug: {
      type: String,
      lowercase: true,
      index: true,
    },

    // Display Properties
    subtitle: {
      type: String,
      trim: true,
    },
    thumbnail: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Media",
    },
    meta: {
      hex_code: String, // For color-type
      image_url: String, // For swatch-type
    },

    // System
    created_at: {
      type: Date,
      default: Date.now,
    },
    updated_at: {
      type: Date,
      default: Date.now,
    },
  },
  {
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Auto-generate slug
attributeValueSchema.pre("save", function (next) {
  if (this.isModified("value")) {
    this.slug = slugify(this.value, {
      lower: true,
      strict: true,
    });
  }
  next();
});

// Indexes
attributeValueSchema.index({ attribute_id: 1, slug: 1 }, { unique: true });
attributeValueSchema.index({ attribute_id: 1, value: 1 }, { unique: true });

const AttributeValue = mongoose.model("AttributeValue", attributeValueSchema);
export default AttributeValue;
