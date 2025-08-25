"use strict";

function _typeof(obj) { if (typeof Symbol === "function" && typeof Symbol.iterator === "symbol") { _typeof = function _typeof(obj) { return typeof obj; }; } else { _typeof = function _typeof(obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; }; } return _typeof(obj); }

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports["default"] = void 0;

var _mongoose = _interopRequireWildcard(require("mongoose"));

function _getRequireWildcardCache() { if (typeof WeakMap !== "function") return null; var cache = new WeakMap(); _getRequireWildcardCache = function _getRequireWildcardCache() { return cache; }; return cache; }

function _interopRequireWildcard(obj) { if (obj && obj.__esModule) { return obj; } if (obj === null || _typeof(obj) !== "object" && typeof obj !== "function") { return { "default": obj }; } var cache = _getRequireWildcardCache(); if (cache && cache.has(obj)) { return cache.get(obj); } var newObj = {}; var hasPropertyDescriptor = Object.defineProperty && Object.getOwnPropertyDescriptor; for (var key in obj) { if (Object.prototype.hasOwnProperty.call(obj, key)) { var desc = hasPropertyDescriptor ? Object.getOwnPropertyDescriptor(obj, key) : null; if (desc && (desc.get || desc.set)) { Object.defineProperty(newObj, key, desc); } else { newObj[key] = obj[key]; } } } newObj["default"] = obj; if (cache) { cache.set(obj, newObj); } return newObj; }

// --- 1. Embedded Sub-schemas --- //
// Shipping
var shippingSchema = new _mongoose.Schema({
  weight: {
    type: Number,
    "default": null
  },
  dimensions: {
    length: {
      type: Number,
      "default": null
    },
    width: {
      type: Number,
      "default": null
    },
    height: {
      type: Number,
      "default": null
    }
  },
  volumetricWeight: {
    type: Number,
    "default": null
  },
  hazardous: {
    type: Boolean,
    "default": false
  }
}, {
  _id: false
}); // Banner (for marketing/promos)

var bannerSchema = new _mongoose.Schema({
  showSection: {
    type: Boolean,
    "default": true
  },
  position: {
    type: String,
    "enum": ["left", "right", "center", "top", "bottom"],
    "default": "right"
  },
  preTitle: String,
  title: String,
  subTitle: String,
  shadowText: String,
  description: String,
  buttonName: String,
  buttonUrl: String,
  bannerImage: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Media"
  },
  icon: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Media"
  }
}, {
  _id: false
}); // Influencer Video content

var influencerVideoSchema = new _mongoose.Schema({
  showSection: {
    type: Boolean,
    "default": true
  },
  videos: [{
    type: String
  }]
}, {
  _id: false
}); // Featured Banner content

var featuredBannerSchema = new _mongoose.Schema({
  showSection: {
    type: Boolean,
    "default": true
  },
  preTitle: String,
  title: String,
  videoUrl: String,
  buttonName: String,
  buttonUrl: String,
  bannerImage: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Media"
  }
}, {
  _id: false
}); // Compare Features (Flexible, Optional)

var featureCompareDetailSchema = new _mongoose.Schema({
  productId: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Product",
    required: true
  },
  featurePresent: {
    type: Boolean,
    required: true
  },
  description: {
    type: String,
    required: true
  }
}, {
  _id: false
});
var compareFeatureSchema = new _mongoose.Schema({
  featureId: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Feature",
    required: true
  },
  details: [featureCompareDetailSchema]
}, {
  _id: false
});
var compareSectionSchema = new _mongoose.Schema({
  showSection: {
    type: Boolean,
    "default": true
  },
  title: String,
  description: String,
  selectedProducts: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Product"
  }],
  features: [compareFeatureSchema]
}, {
  _id: false
});
var attributeSchema = new _mongoose.Schema({
  attributeId: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Attribute"
  },
  attributeValues: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "AttributeValue"
  }]
}); // --- 2. Main Product Model --- //

var productSchema = new _mongoose.Schema({
  // Core
  name: {
    type: String,
    required: true
  },
  slug: {
    type: String,
    required: true,
    unique: true
  },
  brandId: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Brand",
    required: true
  },
  productLineId: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "ProductLine"
  },
  // optional
  categories: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Category",
    required: true
  }],
  tagIds: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Tag"
  }],
  shortDescription: {
    type: String
  },
  longDescription: {
    type: String
  },
  basePrice: {
    type: Number,
    required: true
  },
  salePrice: {
    type: Number
  },
  // optional special price
  basePhotos: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Media"
  }],
  featuredImage: {
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Media"
  },
  baseFeatures: {
    type: Map,
    of: _mongoose["default"].Schema.Types.ObjectId
  },
  // {featureId: featureValueId}
  attributes: [attributeSchema],
  shipping: shippingSchema,
  // Inventory & Variants
  inventoryType: {
    type: String,
    "enum": ["simple", "with_variants"],
    "default": "simple"
  },
  sku: {
    type: String,
    unique: true
  },
  // only for 'simple' inventory
  stock: {
    type: Number,
    "default": 0
  },
  // for 'simple'
  variants: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Variant"
  }],
  // only used for 'with_variants'
  // Product Relations (upsell, FBT, related, etc.)
  fbtIds: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Product"
  }],
  // frequently bought together
  relatedProductIds: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Product"
  }],
  checkoutUpsellProductIds: [{
    type: _mongoose["default"].Schema.Types.ObjectId,
    ref: "Product"
  }],
  // Marketplace Links (optional)
  amazonLink: String,
  flipkartLink: String,
  ecommerce: {
    type: Boolean,
    "default": false
  },
  // Stock and status
  status: {
    type: Boolean,
    "default": true
  },
  stockStatus: {
    type: String,
    "enum": ["in_stock", "out_of_stock"],
    "default": "in_stock"
  },
  // Marketing Fields (OPTIONAL - embedded)
  banners: {
    one: bannerSchema,
    two: bannerSchema
  },
  influencerVideo: influencerVideoSchema,
  featuredBanner: featuredBannerSchema,
  // Comparison (OPTIONAL)
  compareSection: compareSectionSchema,
  // SEO
  metaTitle: String,
  metaDescription: String,
  specifications: [{
    section: {
      type: String,
      required: true
    },
    // e.g., "General", "Display"
    specs: [{
      key: {
        type: String,
        required: true
      },
      // e.g., "Brand"
      value: {
        type: String,
        required: true
      } // e.g., "Samsung"

    }]
  }]
}, {
  timestamps: true
});
productSchema.index({
  name: "text",
  slug: "text",
  shortDescription: "text",
  longDescription: "text"
});

var _default = _mongoose["default"].model("Product", productSchema);

exports["default"] = _default;