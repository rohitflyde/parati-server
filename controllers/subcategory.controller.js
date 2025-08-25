import Subcategory from '../models/SubCategory.js';
import mongoose from 'mongoose';
import { createMediaEntry } from '../utils/createMediaEntry.js';
import Category from '../models/Category.js';

// CREATE
export const createSubcategory = async (req, res) => {
    try {
        const {
            category,
            title,
            slug,
            description,
            shortDescription,
            status,
            metaTitle,
            metaDescription,
            faqSchema,
        } = req.body;

        // const uploadedBy = req.user?._id || null;

        let img = null;

        const selectedCategory = await Category.findById(category);

        if(!selectedCategory){
            return res.status(400).json({
                success : false,
                message : "No category found"
            })
        }


        if (req.file) {
            try {
                img = await createMediaEntry(req.file, uploadedBy);
            } catch (uploadErr) {
                console.error("Image upload failed:", uploadErr);
                return res.status(500).json({
                    success: false,
                    message: "Image upload failed.",
                    error: uploadErr.message,
                });
            }
        }

        const subcategory = await Subcategory.create({
            category,
            title,
            slug,
            description,
            shortDescription,
            status: status === 'true' || status === true,
            metaTitle,
            metaDescription,
            img,
        });

        selectedCategory.subCategories.push(subcategory._id)

        await selectedCategory.save()

        return res.status(201).json({
            success: true,
            message: "Subcategory created successfully",
            subcategory,
        });
    } catch (err) {
        console.error("Create Subcategory Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to create subcategory",
            error: err.message,
        });
    }
};


// GET ALL
export const getAllSubcategories = async (req, res) => {
    try {
        const subcategories = await Subcategory.find()
            .populate('category', 'title slug')
            .sort({ createdAt: -1 });

        return res.status(200).json({ success: true, count: subcategories.length, subcategories });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch subcategories', error: err.message });
    }
};

// GET ONE
export const getSubcategoryById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(id)) return res.status(400).json({ success: false, message: 'Invalid Subcategory ID' });

        const subcategory = await Subcategory.findById(id).populate('category', 'title slug');
        if (!subcategory) return res.status(404).json({ success: false, message: 'Subcategory not found' });

        return res.status(200).json({ success: true, subcategory });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to fetch subcategory', error: err.message });
    }
};

// UPDATE
export const updateSubcategory = async (req, res) => {
    try {
        const { id } = req.params;
        const updated = await Subcategory.findByIdAndUpdate(id, req.body, { new: true, runValidators: true });

        if (!updated) return res.status(404).json({ success: false, message: 'Subcategory not found' });

        return res.status(200).json({ success: true, message: 'Subcategory updated successfully', subcategory: updated });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to update subcategory', error: err.message });
    }
};

// DELETE
export const deleteSubcategory = async (req, res) => {
    try {
        const { id } = req.params;
        const deleted = await Subcategory.findByIdAndDelete(id);

        if (!deleted) return res.status(404).json({ success: false, message: 'Subcategory not found' });

        return res.status(200).json({ success: true, message: 'Subcategory deleted successfully' });
    } catch (err) {
        return res.status(500).json({ success: false, message: 'Failed to delete subcategory', error: err.message });
    }
}


// GET SUBCATEGORY BY SLUG
export const getSubcategoryBySlug = async (req, res) => {
    try {
        const { slug } = req.params;

        const subcategory = await Subcategory.findOne({ slug })
            .populate('img')
            .populate('category', 'title slug');

        if (!subcategory) {
            return res.status(404).json({
                success: false,
                message: 'Subcategory not found',
            });
        }

        return res.status(200).json({
            success: true,
            subcategory,
        });
    } catch (err) {
        console.error('Fetch Subcategory Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch subcategory',
            error: err.message,
        });
    }
};





// CHECK SLUG AVAILABILITY FOR SUBCATEGORY
export const checkSubcategorySlug = async (req, res) => {
    try {
        const { slug } = req.query;
        console.log(slug)

        if (!slug || typeof slug !== 'string') {
            return res.status(400).json({
                success: false,
                message: 'Slug is required and must be a string',
            });
        }

        const existing = await Subcategory.findOne({ slug });

        return res.status(200).json({
            success: true,
            exists: !!existing,
        });
    } catch (err) {
        console.error('Slug Check Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to check slug availability',
            error: err.message,
        });
    }
};
