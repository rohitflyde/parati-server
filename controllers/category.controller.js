import Category from "../models/Category.js";
import mongoose from "mongoose";
import { createMediaEntry } from "../utils/createMediaEntry.js";

// Helper to parse JSON strings safely
const safeJsonParse = (str) => {
    try {
        return JSON.parse(str);
    } catch {
        return null;
    }
};

// Create a new Category
export const createCategory = async (req, res) => {
    try {
        const {
            title,
            slug,
            description,
            shortDescription,
            status,
            metaTitle,
            metaDescription,
        } = req.body;

        // Validate required fields
        if (!title || !slug) {
            return res.status(400).json({ message: "Title and slug are required" });
        }

        // Check unique slug
        const slugExists = await Category.findOne({ slug });
        if (slugExists) {
            return res.status(409).json({ message: "Slug already exists" });
        }

        let imgId = null;
        if (req.file) {
            imgId = await createMediaEntry(req.file, req.user._id);
        }

        // Improved helper function with better error handling
        const convertIds = (data) => {
            if (!data) return data;

            if (Array.isArray(data)) {
                return data.map(item => {
                    if (!item) return item;

                    const newItem = { ...item };

                    // Handle hero slider images
                    ['bannerImageMobile', 'bannerImageDesktop', 'bannerImageThumbnail'].forEach(field => {
                        if (newItem[field] && mongoose.isValidObjectId(newItem[field])) {
                            newItem[field] = new mongoose.Types.ObjectId(newItem[field]);
                        } else {
                            newItem[field] = null;
                        }
                    });

                    return newItem;
                });
            }

            if (typeof data === 'object') {
                const newData = { ...data };

                // Handle feature box images
                ['box1', 'box2', 'box3'].forEach(box => {
                    if (newData[box]?.image && mongoose.isValidObjectId(newData[box].image)) {
                        newData[box].image = new mongoose.Types.ObjectId(newData[box].image);
                    } else if (newData[box]?.image) {
                        newData[box].image = null;
                    }
                });

                return newData;
            }

            return data;
        };

        const parsedHeroSlider = heroSlider ? safeJsonParse(heroSlider) : [];
        const parsedFeatureBoxes = featureBoxes ? safeJsonParse(featureBoxes) : undefined;

        // Validate and convert products array
        let convertedProducts = [];
        if (Array.isArray(products)) {
            convertedProducts = products
                .filter(id => mongoose.isValidObjectId(id))
                .map(id => new mongoose.Types.ObjectId(id));
        }

        // Validate parent category ID
        let convertedParentId = null;
        if (parentCategoryId && mongoose.isValidObjectId(parentCategoryId)) {
            convertedParentId = new mongoose.Types.ObjectId(parentCategoryId);
        }

        const newCategory = new Category({
            title: title.trim(),
            slug: slug.trim().toLowerCase(),
            description,
            shortDescription,
            img: imgId,
            status: status !== undefined ? status : true,
            metaTitle,
            metaDescription,
            heroSlider: convertIds(parsedHeroSlider),
            featureBoxes: convertIds(parsedFeatureBoxes),
            parentCategoryId: convertedParentId,
            products: convertedProducts
        });

        const savedCategory = await newCategory.save();
        await savedCategory.populate("img");

        return res.status(201).json(savedCategory);
    } catch (err) {
        console.error("Create Category Error:", err);
        return res.status(500).json({
            message: "Internal server error",
            error: err.message
        });
    }
};


// Get list of all categories, optionally nested
export const getAllCategories = async (req, res) => {
    try {
        const categories = await Category.find()
            .populate("img")
            .sort({ createdAt: -1 })
            .exec();
        return res.json(categories);
    } catch (err) {
        console.error("Get Categories Error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Get single category by ID
export const getCategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid category ID" });

        const category = await Category.findById(id).populate("img").exec();
        if (!category) return res.status(404).json({ message: "Category not found" });

        return res.json(category);
    } catch (err) {
        console.error("Get Category Error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};

// Update category by ID
export const updateCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) {
            return res.status(400).json({ message: "Invalid category ID" });
        }

        const updateData = { ...req.body };

        // Helper function to convert string IDs to ObjectIds in nested objects
        const convertIds = (data) => {
            if (!data) return data;

            if (Array.isArray(data)) {
                return data.map(item => {
                    if (item.bannerImageMobile) {
                        item.bannerImageMobile = mongoose.isValidObjectId(item.bannerImageMobile)
                            ? new mongoose.Types.ObjectId(item.bannerImageMobile)
                            : null;
                    }
                    if (item.bannerImageDesktop) {
                        item.bannerImageDesktop = mongoose.isValidObjectId(item.bannerImageDesktop)
                            ? new mongoose.Types.ObjectId(item.bannerImageDesktop)
                            : null;
                    }
                    if (item.bannerImageThumbnail) {
                        item.bannerImageThumbnail = mongoose.isValidObjectId(item.bannerImageThumbnail)
                            ? new mongoose.Types.ObjectId(item.bannerImageThumbnail)
                            : null;
                    }
                    return item;
                });
            }

            if (typeof data === 'object') {
                if (data.box1?.image) {
                    data.box1.image = mongoose.isValidObjectId(data.box1.image)
                        ? new mongoose.Types.ObjectId(data.box1.image)
                        : null;
                }
                if (data.box2?.image) {
                    data.box2.image = mongoose.isValidObjectId(data.box2.image)
                        ? new mongoose.Types.ObjectId(data.box2.image)
                        : null;
                }
                if (data.box3?.image) {
                    data.box3.image = mongoose.isValidObjectId(data.box3.image)
                        ? new mongoose.Types.ObjectId(data.box3.image)
                        : null;
                }
                return data;
            }

            return data;
        };

        // Parse JSON fields if sent as strings
        if (updateData.heroSlider) {
            updateData.heroSlider = convertIds(safeJsonParse(updateData.heroSlider)) || [];
        }
        if (updateData.featureBoxes) {
            updateData.featureBoxes = convertIds(safeJsonParse(updateData.featureBoxes));
        }

        // Handle products array
        if (updateData.products && !Array.isArray(updateData.products)) {
            updateData.products = [];
        } else if (updateData.products) {
            updateData.products = updateData.products
                .filter(id => mongoose.isValidObjectId(id))
                .map(id => new mongoose.Types.ObjectId(id));
        }

        // Handle parent category ID
        if (updateData.parentCategoryId) {
            updateData.parentCategoryId = mongoose.isValidObjectId(updateData.parentCategoryId)
                ? new mongoose.Types.ObjectId(updateData.parentCategoryId)
                : null;
        } else if ('parentCategoryId' in updateData) {
            updateData.parentCategoryId = null;
        }

        // Handle new image upload if file present
        if (req.file) {
            const imgId = await createMediaEntry(req.file, req.user._id);
            updateData.img = imgId;
        } else if (updateData.img === null || updateData.img === 'null') {
            // Handle case when image is being removed
            updateData.img = null;
        }

        // Ensure slug lowercase and trimmed if updating slug or title
        if (updateData.slug) {
            updateData.slug = updateData.slug.toLowerCase().trim();
            const slugConflict = await Category.findOne({
                slug: updateData.slug,
                _id: { $ne: id }
            });
            if (slugConflict) {
                return res.status(409).json({
                    message: "Slug already exists for another category"
                });
            }
        }

        if (updateData.title) {
            updateData.title = updateData.title.trim();
        }

        const updatedCategory = await Category.findByIdAndUpdate(
            id,
            updateData,
            {
                new: true,
                runValidators: true
            }
        ).populate("img");

        if (!updatedCategory) {
            return res.status(404).json({ message: "Category not found" });
        }

        return res.json(updatedCategory);
    } catch (err) {
        console.error("Update Category Error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};


// Delete category by ID
export const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid category ID" });

        const deleted = await Category.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: "Category not found" });

        // Optionally: clean up related products/categories or media here

        return res.json({ message: "Category deleted successfully" });
    } catch (err) {
        console.error("Delete Category Error:", err);
        return res.status(500).json({ message: "Internal server error" });
    }
};
