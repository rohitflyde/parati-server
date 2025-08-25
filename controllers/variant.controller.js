import Variant from "../models/Variant.js";
import Product from "../models/Product.js";
import mongoose from "mongoose";
import Attribute from "../models/Attribute.js";
import AttributeValue from "../models/AttributeValue.js";
import { createMediaEntry } from "../utils/createMediaEntry.js";

const getMergedVariantData = async (variantId) => {
  const variant = await Variant.findById(variantId).lean();
  if (!variant) return null;

  const product = await Product.findById(variant.product_id).lean();
  if (!product) return variant; // Return just variant if product not found

  return {
    ...product, // Base product data
    ...variant, // Variant overrides
    // Special handling for arrays
    photos: variant.photos?.length ? variant.photos : product.photos,
    features: variant.features?.length ? variant.features : product.features,
    // Explicitly mark which fields are overridden
    overrides: {
      price: variant.price !== undefined,
      photos: variant.photos?.length > 0,
      description: variant.description !== undefined,
      features: variant.features?.length > 0,
      shipping: variant.shipping_override !== undefined,
    },
  };
};

// CREATE VARIANT
export const createVariant = async (req, res) => {
  try {
    const userId = req.user?._id;

    // Parse fields from req.body
    const {
      productId,
      sku,
      barcode,
      price,
      sale_price: salePrice,
      description,
    } = req.body;

    const attributes = JSON.parse(req.body.attributes || "[]");
    const features = JSON.parse(req.body.features || "[]");

    const inventory = {
      quantity: 0,
      backorder: false,
      lowStockThreshold: 5,
      stockStatus: "out_of_stock",
      ...JSON.parse(req.body.inventory || "{}"),
    };

    const shippingOverride = JSON.parse(req.body.shipping_override || "{}");

    // Validate required fields
    if (!productId || !sku || !Array.isArray(attributes)) {
      return res.status(400).json({
        success: false,
        message: "productId, sku, and attributes are required",
      });
    }

    // Check if product exists
    const productExists = await Product.exists({ _id: productId });
    if (!productExists) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    // Check for duplicate SKU
    // const skuExists = await Variant.exists({ sku });
    // if (skuExists) {
    //   return res.status(409).json({
    //     success: false,
    //     message: "SKU already exists",
    //   });
    // }

    // Validate attributes
    const attributeValidation = await validateAttributes(attributes);
    if (!attributeValidation.valid) {
      return res.status(400).json({
        success: false,
        message: "Invalid attributes",
        errors: attributeValidation.errors,
      });
    }

    // Upload photos via createMediaEntry
    let photos = [];
    if (req.files && req.files.length > 0) {
      const mediaUploads = await Promise.all(
        req.files.map((file) => createMediaEntry(file, userId))
      );
      photos = mediaUploads;
    }

    // Create Variant
    const variant = await Variant.create({
      productId,
      sku,
      barcode,
      attributes,
      price,
      salePrice,
      description,
      features,
      inventory,
      shippingOverride,
      photos,
      // Optional: created_by: userId
    });

    await Product.findByIdAndUpdate(productId, {
      $push: { variants: variant._id },
    });

    return res.status(201).json({
      success: true,
      message: "Variant created successfully",
      data: await getMergedVariantData(variant._id),
    });
  } catch (err) {
    console.error("Create Variant Error:", err);
    return res.status(500).json({
      success: false,
      message: err.message ,
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// GET VARIANT BY ID
export const getVariant = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Variant ID",
      });
    }

    const mergedData = await getMergedVariantData(id);
    if (!mergedData) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      data: mergedData,
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch variant",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// UPDATE VARIANT
export const updateVariant = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;
    const updateData = { ...req.body, updated_by: userId };

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid Variant ID",
      });
    }

    // Prevent changing product_id
    if (updateData.product_id) {
      delete updateData.product_id;
    }

    // Validate attributes if being updated
    if (updateData.attributes) {
      const validation = await validateAttributes(updateData.attributes);
      if (!validation.valid) {
        return res.status(400).json({
          success: false,
          message: "Invalid attributes",
          errors: validation.errors,
        });
      }
    }

    // Check for duplicate SKU
    if (updateData.sku) {
      const skuExists = await Variant.exists({
        sku: updateData.sku,
        _id: { $ne: id },
      });
      if (skuExists) {
        return res.status(409).json({
          success: false,
          message: "SKU already exists",
        });
      }
    }

    const updatedVariant = await Variant.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    if (!updatedVariant) {
      return res.status(404).json({
        success: false,
        message: "Variant not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Variant updated successfully",
      data: await getMergedVariantData(updatedVariant._id),
    });
  } catch (err) {
    console.error("Update Variant Error:", err);
    return res.status(500).json({
      success: false,
      message: "Failed to update variant",
      error: process.env.NODE_ENV === "development" ? err.message : undefined,
    });
  }
};

// Helper function to validate attributes
async function validateAttributes(attributes) {
  console.log("attributes: ", attributes);

  const errors = [];
  const seenAttributes = new Set();

  for (const attr of attributes) {
    if (!attr.attribute_id || !attr.attribute_value_id) {
      errors.push(
        "Each attribute must have attribute_id and attribute_value_id"
      );
      continue;
    }

    // Check for duplicate attributes
    if (seenAttributes.has(attr.attribute_id.toString())) {
      errors.push(`Duplicate attribute: ${attr.attribute_id}`);
      continue;
    }
    seenAttributes.add(attr.attribute_id.toString());

    // Check if attribute exists
    const attributeExists = await mongoose.models.Attribute.exists({
      _id: attr.attribute_id,
    });
    if (!attributeExists) {
      errors.push(`Attribute not found: ${attr.attribute_id}`);
      continue;
    }

    // Check if value exists in attribute
    const attribute = await Attribute.findById(attr.attribute_id);
    console.log("Fetched attribute:", attribute);

    const valueExists = await AttributeValue.findById({
      _id: attr.attribute_value_id,
    });
    if (!valueExists) {
      errors.push(
        `Value ${attr.attribute_value_id} not found in attribute ${attr.attribute_id}`
      );
    }
  }

  return {
    valid: errors.length === 0,
    errors: errors.length > 0 ? errors : undefined,
  };
}
