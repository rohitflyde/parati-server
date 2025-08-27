import Product from "../models/Product.js";
import Category from "../models/Category.js";
import Wishlist from "../models/Wishlist.js";

import mongoose from "mongoose";
import { createMediaEntry } from "../utils/createMediaEntry.js";

// Create Product
export const createProduct = async (req, res) => {
  try {
    const {
      name,
      slug,
      brandId,
      productLineId,
      tagIds,
      shortDescription,
      longDescription,
      basePrice,
      salePrice,
      // baseFeatures = '',
      baseAttributes = '',
      shipping,
      inventoryType,
      sku,
      stock,
      variants,
      fbtIds,
      relatedProductIds,
      checkoutUpsellProductIds,
      amazonLink,
      flipkartLink,
      ecommerce,
      status,
      stockStatus,
      banners,
      influencerVideo,
      featuredBanner,
      compareSection,
      metaTitle,
      metaDescription,
    } = req.body;

    console.log(req.body);

    const categories =
      typeof req.body.categories === "string"
        ? JSON.parse(req.body.categories)
        : req.body.categories;

    // Basic validation
    if (!name || !slug || !brandId || !categories || !basePrice) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    // Price validation
    if (salePrice && salePrice > basePrice) {
      return res
        .status(400)
        .json({ message: "Sale price cannot be greater than base price" });
    }

    // Validate ObjectId fields
    if (!mongoose.isValidObjectId(brandId)) {
      return res.status(400).json({ message: "Invalid brandId" });
    }
    if (categories.some((id) => !mongoose.isValidObjectId(id))) {
      return res.status(400).json({ message: "Invalid category IDs" });
    }

    // Handle image uploads and create media entries
    const uploadedBy = req.user._id;

    // Process featured image
    let featuredImageId = null;
    if (req.files?.featuredImage) {
      featuredImageId = await createMediaEntry(
        req.files.featuredImage[0],
        uploadedBy
      );
    }

    // Process base photos
    let basePhotoIds = [];
    if (req.files?.basePhotos) {
      for (const file of req.files.basePhotos) {
        const mediaId = await createMediaEntry(file, uploadedBy);
        basePhotoIds.push(mediaId);
      }
    }

    // Process banner images
    const processedBanners = {};
    if (banners) {
      const bannersObj =
        typeof banners === "string" ? JSON.parse(banners) : banners;

      for (const [bannerKey, bannerData] of Object.entries(bannersObj)) {
        processedBanners[bannerKey] = { ...bannerData };

        // Handle banner image
        const bannerImageField = `banners.${bannerKey}.bannerImage`;
        if (req.files?.[bannerImageField]) {
          const mediaId = await createMediaEntry(
            req.files[bannerImageField][0],
            uploadedBy
          );
          processedBanners[bannerKey].bannerImage = mediaId;
        }

        // Handle banner icon
        const bannerIconField = `banners.${bannerKey}.icon`;
        if (req.files?.[bannerIconField]) {
          const mediaId = await createMediaEntry(
            req.files[bannerIconField][0],
            uploadedBy
          );
          processedBanners[bannerKey].icon = mediaId;
        }
      }
    }

    // Process featured banner
    let processedFeaturedBanner = null;
    if (featuredBanner) {
      processedFeaturedBanner =
        typeof featuredBanner === "string"
          ? JSON.parse(featuredBanner)
          : featuredBanner;

      if (req.files?.["featuredBanner.bannerImage"]) {
        const mediaId = await createMediaEntry(
          req.files["featuredBanner.bannerImage"][0],
          uploadedBy
        );
        processedFeaturedBanner.bannerImage = mediaId;
      }
    }

    // Create product document
    const newProduct = new Product({
      name,
      slug,
      brandId,
      productLineId,
      categories: Array.isArray(categories)
        ? categories
        : JSON.parse(categories),
      tagIds: tagIds
        ? Array.isArray(tagIds)
          ? tagIds
          : JSON.parse(tagIds)
        : [],
      shortDescription,
      longDescription,
      basePrice,
      salePrice,
      basePhotos: basePhotoIds,
      featuredImage: featuredImageId,
      // baseFeatures: baseFeatures
      //   ? typeof baseFeatures === "string"
      //     ? JSON.parse(baseFeatures)
      //     : baseFeatures
      //   : {},
      baseAttributes: baseAttributes
        ? typeof baseAttributes === "string"
          ? JSON.parse(baseAttributes)
          : baseAttributes
        : {},
      shipping: shipping
        ? typeof shipping === "string"
          ? JSON.parse(shipping)
          : shipping
        : {},
      inventoryType,
      sku: inventoryType === "simple" ? sku : undefined,
      stock: inventoryType === "simple" ? stock : undefined,
      variants:
        inventoryType === "with_variants"
          ? Array.isArray(variants)
            ? variants
            : JSON.parse(variants)
          : [],
      fbtIds: fbtIds
        ? Array.isArray(fbtIds)
          ? fbtIds
          : JSON.parse(fbtIds)
        : [],
      relatedProductIds: relatedProductIds
        ? Array.isArray(relatedProductIds)
          ? relatedProductIds
          : JSON.parse(relatedProductIds)
        : [],
      checkoutUpsellProductIds: checkoutUpsellProductIds
        ? Array.isArray(checkoutUpsellProductIds)
          ? checkoutUpsellProductIds
          : JSON.parse(checkoutUpsellProductIds)
        : [],
      amazonLink,
      flipkartLink,
      ecommerce,
      status,
      stockStatus,
      banners: processedBanners,
      influencerVideo: influencerVideo
        ? typeof influencerVideo === "string"
          ? JSON.parse(influencerVideo)
          : influencerVideo
        : null,
      featuredBanner: processedFeaturedBanner,
      compareSection: compareSection
        ? typeof compareSection === "string"
          ? JSON.parse(compareSection)
          : compareSection
        : null,
      metaTitle,
      metaDescription,
    });

    console.log(newProduct);

    const savedProduct = await newProduct.save();
    return res.status(201).json(savedProduct);
  } catch (error) {
    // Duplicate key error
    if (error.code === 11000) {
      let duplicateField = Object.keys(error.keyPattern)[0];
      return res
        .status(400)
        .json({ message: `${duplicateField} must be unique` });
    }

    // Validation error
    if (error.name === "ValidationError") {
      return res.status(400).json({ message: error.message });
    }

    // JSON parse error
    if (error instanceof SyntaxError && error.message.includes("JSON")) {
      return res
        .status(400)
        .json({ message: "Invalid JSON in one of the fields" });
    }

    console.error("Error creating product:", error);
    return res.status(500).json({ message: error.message });
  }
};
// Get product by ID
export const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const product = await Product.findById(id)
      .populate("brandId")
      .populate("categories")
      .populate("tagIds")
      .populate("productLineId")
      .populate("fbtIds")
      .populate("relatedProductIds")
      .populate("checkoutUpsellProductIds")
      .populate("featuredImage")
      .populate("basePhotos")
      .populate({
        path: "variants",
        populate: [
          {
            path: "attributes.attribute_id",
            model: "Attribute",
          },
          {
            path: "attributes.attribute_value_id",
            model: "AttributeValue",
          },
          {
            path: "features.feature_id",
            model: "Feature",
          },
          {
            path: "features.feature_value_id",
            model: "FeatureValue",
          },
          {
            path: "images",
            model: "Media",
          },
        ],
      })
      .exec();

    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    res.json(product);
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ message: "Server error" });
  }
};
// Get product by slug
export const getProductBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const product = await Product.findOne({ slug })
      .populate([
        { path: "brandId", select: "name slug logo" },
        { path: "categories", select: "title slug" },
        { path: "tagIds", select: "name" },
        { path: "productLineId", select: "name" },
        { path: "featuredImage", select: "filePath" },
        {
          path: "basePhotos",
          select: "filePath",
          options: { sort: { createdAt: 1 } },
        },
        {
          path: "variants",
          populate: [
            {
              path: "attributes.attribute_id",
              select: "name slug",
              model: "Attribute",
            },
            {
              path: "attributes.attribute_value_id",
              select: "value",
              model: "AttributeValue",
            },
            {
              path: "features.feature_id",
              select: "name",
              model: "Feature",
            },
            {
              path: "features.feature_value_id",
              select: "value",
              model: "FeatureValue",
            },
            {
              path: "photos",
              select: "filePath",
              model: "Media",
            },
          ],
        },
        {
          path: "attributes.attributeId",
          select: "name slug",
          model: "Attribute",
        },
        {
          path: "attributes.attributeValues",
          select: "value",
          model: "AttributeValue",
        },

        // ✅ FBT populate
        {
          path: "fbtIds",
          select: "name slug featuredImage salePrice basePrice",
          populate: {
            path: "featuredImage",
            model: "Media",
            select: "filePath",
          },
        },

        // ✅ Related products populate
        {
          path: "relatedProductIds",
          select: "name slug featuredImage salePrice basePrice",
          populate: {
            path: "featuredImage",
            model: "Media",
            select: "filePath",
          },
        },

        // ✅ Checkout upsell populate
        {
          path: "checkoutUpsellProductIds",
          select: "name slug featuredImage salePrice basePrice",
          populate: {
            path: "featuredImage",
            model: "Media",
            select: "filePath",
          },
        },
      ])
      .lean();

    if (!product) {
      return res.status(404).json({
        success: false,
        message: "Product not found",
      });
    }

    const transformedProduct = {
      ...product,
      title: product.name,
      sp: product.salePrice || product.basePrice,
      mrp: product.basePrice,
      variantName:
        product.variants?.length > 0 ? product.variants[0].name : null,
      features: product.baseFeatures?.features || [],
      addImages: product.basePhotos || [],
      featuredImg: product.featuredImage,
      category: product.categories?.length > 0 ? product.categories[0] : null,
    };

    return res.json({
      success: true,
      product: transformedProduct,
    });
  } catch (error) {
    console.error("Error fetching product by slug:", error);
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const searchProducts = async (req, res) => {
  try {
    const { query, category, limit = 10 } = req.query;

    // Build search query
    const searchQuery = {};

    // Text search condition
    if (query) {
      searchQuery.$or = [
        { name: { $regex: query, $options: "i" } },
        { description: { $regex: query, $options: "i" } },
        { shortDescription: { $regex: query, $options: "i" } },
        { tags: { $regex: query, $options: "i" } },
      ];
    }

    // Category filter
    if (category) {
      searchQuery.category = { $regex: new RegExp(`^${category}$`, "i") }; // Case-insensitive
    }

    // Execute search with sorting
    const products = await Product.find(searchQuery)
      .limit(parseInt(limit))
      .sort({ createdAt: -1 }) // Sort by newest first (adjust as needed)
      .select(
        "name salePrice featuredImage rating soldCount basePrice stockStatus slug"
      )
      .populate({
        path: "featuredImage",
        select: "filePath fileName",
      })
      .lean();

    res.json(products);
  } catch (error) {
    console.error("Search error:", error);
    res.status(500).json({
      message: "Search failed",
      error: error.message,
    });
  }
};

export const getAllProducts = async (req, res) => {
  try {
    const {
      status,
      brandId,
      categoryId,
      search,
      limit,
      page,
      sort,
      priceRange,
      inStock,
    } = req.query;

    const filter = {};

    if (status !== undefined) {
      filter.status = status === "true";
    }

    if (brandId && mongoose.isValidObjectId(brandId)) {
      filter.brandId = brandId;
    }

    if (categoryId && mongoose.isValidObjectId(categoryId)) {
      filter.categories = categoryId;
    }

    if (search) {
      filter.$or = [
        { name: new RegExp(search, "i") },
        { slug: new RegExp(search, "i") },
      ];
    }

    // ✅ Add price range filtering
    if (priceRange !== "all" && priceRange) {
      const [minStr, maxStr] = priceRange.split("-");
      const min = parseInt(minStr, 10);
      const max = maxStr ? parseInt(maxStr, 10) : null;

      // Use salePrice instead of basePrice
      filter.salePrice = filter.salePrice || {};

      if (!isNaN(min)) {
        filter.salePrice.$gte = min;
      }

      if (!isNaN(max)) {
        filter.salePrice.$lte = max;
      }
    }

    if (inStock == "true") {
      filter.stockStatus = "in_stock";
    }

    const pageNum = parseInt(page) || 1;
    const limitNum = parseInt(limit) || 20;
    const skip = (pageNum - 1) * limitNum;

    const products = await Product.find(filter)
      .populate([
        { path: "brandId" },
        { path: "productLineId" },
        { path: "categories" },
        { path: "tagIds" },
        { path: "featuredImage" },
        { path: "basePhotos" },
        { path: "attributes.attributeId" },
        { path: "attributes.attributeValues" },
        {
          path: "baseFeatures",
          options: { strictPopulate: false },
        },
        {
          path: "variants",
          populate: [
            { path: "attributes.attribute_id" },
            { path: "attributes.attribute_value_id" },
            { path: "features.feature_id" },
            { path: "features.feature_value_id" },
          ],
        },
        { path: "fbtIds" },
        { path: "relatedProductIds" },
        { path: "checkoutUpsellProductIds" },
        { path: "banners.one.bannerImage", model: "Media" },
        { path: "banners.one.icon", model: "Media" },
        { path: "banners.two.bannerImage", model: "Media" },
        { path: "banners.two.icon", model: "Media" },
        { path: "featuredBanner.bannerImage", model: "Media" },
        { path: "compareSection.selectedProducts" },
        { path: "compareSection.features.featureId" },
        { path: "compareSection.features.details.productId" },
      ])
      .sort(sort || { createdAt: -1 })
      .skip(skip)
      .limit(limitNum)
      .lean();

    const totalCount = await Product.countDocuments(filter);

    return res.json({
      total: totalCount,
      page: pageNum,
      limit: limitNum,
      products,
    });
  } catch (error) {
    console.error("Error fetching all products:", error);
    res.status(500).json({ message: error.message });
  }
};

// Update Product (partial or full)
export const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateFields = req.body;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    // Optional: validate price etc here like in createProduct

    const updatedProduct = await Product.findByIdAndUpdate(id, updateFields, {
      new: true, // return updated doc
      runValidators: true,
    }).exec();

    if (!updatedProduct)
      return res.status(404).json({ message: "Product not found" });

    res.json(updatedProduct);
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Delete Product
export const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const deletedProduct = await Product.findByIdAndDelete(id);
    if (!deletedProduct)
      return res.status(404).json({ message: "Product not found" });

    // TODO: Cascade delete variants or media as needed if applicable

    res.json({ message: "Product deleted" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const getProductsByCategorySlug = async (req, res) => {
  const { slug } = req.params;

  // console.log(slug)

  try {
    // Step 1: Find category by slug
    const category = await Category.findOne({ slug });

    if (!category) {
      return res.status(404).json({ message: "Category not found", slug });
    }

    console.log(category);

    // console.log(category)

    const products = await Product.find({
      categories: { $in: [category._id] },
    }).populate([{ path: "categories" }, { path: "featuredImage" }]);

    // console.log(products[0])

    // Optional: populate brand if you want brand name
    // .populate('brandId', 'name');

    return res.json({
      category: category.title,
      products,
    });
  } catch (error) {
    console.error("Error fetching category products:", error);
    res.status(500).json({ message: error.message });
  }
};

export const getBulkProductsByIds = async (req, res) => {
  try {
    const { ids } = req.body;
    console.log("ids: ", ids);

    if (!Array.isArray(ids) || ids.length === 0) {
      return res
        .status(400)
        .json({ error: true, message: "Invalid or empty product ID array" });
    }

    // Validate ObjectIds
    const objectIds = ids
      .filter((id) => mongoose.isValidObjectId(id))
      .map((id) => new mongoose.Types.ObjectId(id));

    const products = await Product.find({ _id: { $in: objectIds } })
      .select("_id  featuredImg, title")
      .populate("featuredImg");

    return res.status(200).json({
      error: false,
      products,
    });
  } catch (error) {
    console.error("Error fetching products by IDs:", error);
    return res.status(500).json({
      error: true,
      message: "Internal server error",
    });
  }
};

// Add or Update Attributes for a Product
export const addAttributesToProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const { attributes } = req.body;

    // Validate product ID
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    // Validate attributes array
    if (!Array.isArray(attributes) || attributes.length === 0) {
      return res
        .status(400)
        .json({ message: "Attributes should be a non-empty array" });
    }

    // Validate each attribute object
    for (const attr of attributes) {
      if (
        !mongoose.isValidObjectId(attr.attributeId) ||
        !Array.isArray(attr.attributeValues) ||
        attr.attributeValues.some((val) => !mongoose.isValidObjectId(val))
      ) {
        return res.status(400).json({
          message: "Invalid attribute format. Ensure valid ObjectIds.",
        });
      }
    }

    // Find and update product
    const product = await Product.findById(id);
    if (!product) {
      return res.status(404).json({ message: "Product not found" });
    }

    // Replace existing attributes (or you can choose to merge instead)
    product.attributes = attributes;

    await product.save();

    return res.status(200).json({
      message: "Attributes updated successfully",
      attributes: product.attributes,
    });
  } catch (error) {
    console.error("Error adding attributes:", error);
    res.status(500).json({ message: "Server error" });
  }
};

export const updateProductSpecifications = async (req, res) => {
  try {
    const { productId } = req.params;
    const { specifications } = req.body;

    if (!mongoose.Types.ObjectId.isValid(productId)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    if (!Array.isArray(specifications)) {
      return res
        .status(400)
        .json({ message: "Specifications must be an array" });
    }

    // Optional: Basic validation
    for (const section of specifications) {
      if (
        typeof section.section !== "string" ||
        !Array.isArray(section.specs)
      ) {
        return res.status(400).json({
          message:
            "Each specification section must have a section name and an array of specs",
        });
      }
      for (const spec of section.specs) {
        if (typeof spec.key !== "string" || typeof spec.value !== "string") {
          return res.status(400).json({
            message: "Each spec must contain string 'key' and 'value'",
          });
        }
      }
    }

    const updatedProduct = await Product.findByIdAndUpdate(
      productId,
      { $set: { specifications } },
      { new: true }
    );

    if (!updatedProduct) {
      return res.status(404).json({ message: "Product not found" });
    }

    return res.status(200).json({
      message: "Specifications updated successfully",
      product: updatedProduct,
    });
  } catch (error) {
    console.error("Error updating specifications:", error);
    return res.status(500).json({ message: "Server error" });
  }
};
