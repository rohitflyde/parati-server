import mongoose from "mongoose";

const variantSchema = new mongoose.Schema(
  {
    // Product Reference
    productId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Product",
      required: true,
      index: true,
    },

    // Identification
    sku: {
      type: String,
      required: true,
      //   unique: true,
      trim: true,
      uppercase: true,
    },
    barcode: {
      type: String,
      trim: true,
      index: true,
    },

    // Attribute Combinations
    attributes: [
      {
        attribute_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Attribute",
          required: true,
        },
        attribute_value_id: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "AttributeValue",
          required: true,
        },
      },
    ],

    // Overridable Properties
    photos: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Media",
      },
    ],
    price: {
      type: Number,
      min: 0,
    },
    salePrice: {
      type: Number,
      min: 0,
      // validate: {
      //   validator: function (v) {
      //     return v <= this.price;
      //   },
      //   message: "Sale price must be less than or equal to regular price",
      // },
    },
    description: {
      type: String,
      trim: true,
    },
    features: [
      {
        type: String,
        trim: true,
      },
    ],

    // Inventory Management
    inventory: {
      quantity: {
        type: Number,
        required: true,
        default: 0,
        min: 0,
      },
      backorder: {
        type: Boolean,
        default: false,
      },
      lowStockThreshold: {
        type: Number,
        default: 5,
      },
      stockStatus: {
        type: String,
        enum: ["in_stock", "out_of_stock", "backorder", "preorder"],
        default: "out_of_stock",
      },
    },

    // Shipping Overrides (optional)
    shippingOverride: {
      weight: {
        type: Number,
        min: 0,
      },
      dimensions: {
        length: { type: Number, min: 0 },
        width: { type: Number, min: 0 },
        height: { type: Number, min: 0 },
      },
      shippingClass: {
        type: String,
        trim: true,
      },
    },

    // Variant Status
    status: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Indexes
variantSchema.index({ productId: 1, sku: 1 });
variantSchema.index({
  "attributes.attributeId": 1,
  "attributes.attributeValueId": 1,
});

// Hooks

variantSchema.pre("save", function (next) {
  // Auto update stock status
  if (
    this.isModified("inventory.quantity") ||
    this.isModified("inventory.backorder")
  ) {
    if (this.inventory.quantity > 0) {
      this.inventory.stockStatus = "in_stock";
    } else if (this.inventory.backorder) {
      this.inventory.stockStatus = "backorder";
    } else {
      this.inventory.stockStatus = "out_of_stock";
    }
  }
  next();
});

const Variant = mongoose.model("Variant", variantSchema);
export default Variant;
