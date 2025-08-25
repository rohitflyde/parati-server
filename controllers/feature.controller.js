import Feature from '../models/Feature.js';
import FeatureValue from '../models/FeatureValue.js';
import mongoose from 'mongoose';

// CREATE FEATURE
export const createFeature = async (req, res) => {
    try {
        const { name, input_type, category_ids } = req.body;

        // Validate required fields
        if (!name || !input_type) {
            return res.status(400).json({
                success: false,
                message: 'Name and input_type are required'
            });
        }

        // Validate input type
        const validTypes = ['select', 'range', 'boolean', 'text'];
        if (!validTypes.includes(input_type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid input_type'
            });
        }

        // For range type, validate min/max
        if (input_type === 'range') {
            if (req.body.range_min === undefined || req.body.range_max === undefined) {
                return res.status(400).json({
                    success: false,
                    message: 'range_min and range_max are required for range type'
                });
            }
            if (req.body.range_min >= req.body.range_max) {
                return res.status(400).json({
                    success: false,
                    message: 'range_min must be less than range_max'
                });
            }
        }

        const feature = await Feature.create(req.body);

        return res.status(201).json({
            success: true,
            message: 'Feature created successfully',
            data: feature
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create feature',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// ADD FEATURE VALUE
export const addFeatureValue = async (req, res) => {
    try {
        const { feature_id, product_id, variant_id, value, unit } = req.body;

        // Validate required fields
        if (!feature_id || (!product_id && !variant_id) || value === undefined) {
            return res.status(400).json({
                success: false,
                message: 'feature_id and either product_id or variant_id, and value are required'
            });
        }

        const featureValue = await FeatureValue.create({
            feature_id,
            product_id,
            variant_id,
            value,
            unit
        });

        return res.status(201).json({
            success: true,
            message: 'Feature value added successfully',
            data: featureValue
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to add feature value',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// GET FILTERABLE FEATURES FOR CATEGORY
export const getCategoryFilters = async (req, res) => {
    try {
        const { category_id } = req.params;

        const features = await Feature.find({
            is_filterable: true,
            $or: [
                { filter_visibility: 'all' },
                {
                    filter_visibility: 'category',
                    category_ids: category_id
                }
            ]
        })
            .sort({ filter_order: 1, name: 1 })
            .lean();

        return res.status(200).json({
            success: true,
            data: features
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch filters',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// APPLY FILTERS TO PRODUCTS
export const applyFilters = async (req, res) => {
    try {
        const { category_id } = req.params;
        const filters = req.body; // { feature_slug: value }

        // 1. Get category features
        const features = await Feature.find({
            is_filterable: true,
            $or: [
                { filter_visibility: 'all' },
                {
                    filter_visibility: 'category',
                    category_ids: category_id
                }
            ],
            slug: { $in: Object.keys(filters) }
        }).lean();

        // 2. Build filter query
        const filterQuery = {};

        for (const feature of features) {
            const filterValue = filters[feature.slug];

            switch (feature.input_type) {
                case 'boolean':
                    filterQuery[`features.${feature._id}`] = filterValue === 'true';
                    break;
                case 'range':
                    const [min, max] = filterValue.split('-').map(Number);
                    filterQuery[`features.${feature._id}.value`] = {
                        $gte: min,
                        $lte: max
                    };
                    break;
                case 'select':
                case 'text':
                    filterQuery[`features.${feature._id}.value`] = filterValue;
                    break;
            }
        }

        // 3. Query products (simplified example)
        const products = await Product.find({
            category_ids: category_id,
            ...filterQuery
        });

        return res.status(200).json({
            success: true,
            data: products
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to apply filters',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};