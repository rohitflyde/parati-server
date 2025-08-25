import Tag from '../models/Tag.js';
import mongoose from 'mongoose';

// CREATE TAG
export const createTag = async (req, res) => {
    try {
        const { title, description, status, isFeatured, metaTitle, metaDescription, metaKeywords } = req.body;
        const userId = req.user?._id;

        // Validate required fields
        if (!title) {
            return res.status(400).json({
                success: false,
                message: 'Title is required'
            });
        }

        // Check for existing tag with same title
        const existingTag = await Tag.findOne({ title });
        if (existingTag) {
            return res.status(409).json({
                success: false,
                message: 'Tag with this title already exists'
            });
        }

        // Create new tag
        const tag = await Tag.create({
            title,
            description,
            status: status !== undefined ? status : true,
            isFeatured: isFeatured || false,
            metaTitle: metaTitle || title,
            metaDescription,
            metaKeywords: Array.isArray(metaKeywords) ? metaKeywords : [],
            createdBy: userId,
            updatedBy: userId
        });

        return res.status(201).json({
            success: true,
            message: 'Tag created successfully',
            data: tag
        });

    } catch (err) {
        console.error('Create Tag Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// GET ALL TAGS (with pagination and filtering)
export const getAllTags = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, isFeatured, search } = req.query;
        const skip = (page - 1) * limit;

        // Build query
        const query = {};
        if (status !== undefined) query.status = status;
        if (isFeatured !== undefined) query.isFeatured = isFeatured;
        if (search) {
            query.$text = { $search: search };
        }

        const [tags, total] = await Promise.all([
            Tag.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('image', 'url altText')
                .lean(),
            Tag.countDocuments(query)
        ]);

        return res.status(200).json({
            success: true,
            data: tags,
            meta: {
                total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(total / limit)
            }
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch tags',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// GET TAG BY ID
export const getTagById = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Tag ID'
            });
        }

        const tag = await Tag.findById(id)
            .populate('image', 'url altText')
            .populate('products', 'title slug price mainImage')
            .populate('relatedTags', 'title slug')
            .lean();

        if (!tag) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found'
            });
        }

        return res.status(200).json({
            success: true,
            data: tag
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch tag',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// UPDATE TAG
export const updateTag = async (req, res) => {
    try {
        const { id } = req.params;
        const userId = req.user?._id;
        const updateData = { ...req.body, updatedBy: userId };

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Tag ID'
            });
        }

        // Prevent slug update if provided
        if (updateData.slug) {
            delete updateData.slug;
        }

        const updatedTag = await Tag.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        ).populate('image', 'url altText');

        if (!updatedTag) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Tag updated successfully',
            data: updatedTag
        });

    } catch (err) {
        console.error('Update Tag Error:', err);
        return res.status(500).json({
            success: false,
            message: 'Failed to update tag',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// DELETE TAG
export const deleteTag = async (req, res) => {
    try {
        const { id } = req.params;

        if (!mongoose.Types.ObjectId.isValid(id)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid Tag ID'
            });
        }

        // Soft delete option (set status to false)
        const deletedTag = await Tag.findByIdAndUpdate(
            id,
            { status: false },
            { new: true }
        );

        // Or hard delete:
        // const deletedTag = await Tag.findByIdAndDelete(id);

        if (!deletedTag) {
            return res.status(404).json({
                success: false,
                message: 'Tag not found'
            });
        }

        return res.status(200).json({
            success: true,
            message: 'Tag deleted successfully'
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to delete tag',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// SEARCH TAGS
export const searchTags = async (req, res) => {
    try {
        const { query } = req.query;
        const limit = parseInt(req.query.limit) || 10;

        if (!query) {
            return res.status(400).json({
                success: false,
                message: 'Search query is required'
            });
        }

        const tags = await Tag.find(
            { $text: { $search: query } },
            { score: { $meta: 'textScore' } }
        )
            .sort({ score: { $meta: 'textScore' }, clickCount: -1 })
            .limit(limit)
            .select('title slug')
            .lean();

        return res.status(200).json({
            success: true,
            data: tags
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to search tags',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};