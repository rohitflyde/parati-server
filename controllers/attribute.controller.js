import Attribute from '../models/Attribute.js';
import AttributeValue from '../models/AttributeValue.js';
import mongoose from 'mongoose';

// CREATE ATTRIBUTE
export const createAttribute = async (req, res) => {
    try {
        const { name, input_type, is_variant } = req.body;

        // Validate required fields
        if (!name || !input_type) {
            return res.status(400).json({
                success: false,
                message: 'Name and input_type are required'
            });
        }

        // Create attribute
        const attribute = await Attribute.create(req.body);

        return res.status(201).json({
            success: true,
            message: 'Attribute created successfully',
            data: attribute
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create attribute',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// CREATE ATTRIBUTE VALUE
export const createAttributeValue = async (req, res) => {
    try {
        const { attribute_id, label, value } = req.body;

        // Validate required fields
        if (!attribute_id || !label || !value) {
            return res.status(400).json({
                success: false,
                message: 'attribute_id, label and value are required'
            });
        }

        // Check attribute exists
        const attributeExists = await Attribute.exists({ _id: attribute_id });
        if (!attributeExists) {
            return res.status(404).json({
                success: false,
                message: 'Attribute not found'
            });
        }

        // Check for duplicate value
        const valueExists = await AttributeValue.exists({
            attribute_id,
            $or: [{ value }, { label }]
        });
        if (valueExists) {
            return res.status(409).json({
                success: false,
                message: 'Value or label already exists for this attribute'
            });
        }

        // Create value
        const attributeValue = await AttributeValue.create(req.body);

        return res.status(201).json({
            success: true,
            message: 'Attribute value created successfully',
            data: attributeValue
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to create attribute value',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};

// GET ATTRIBUTES WITH VALUES
export const getAttributesWithValues = async (req, res) => {
    try {
        const { is_variant, is_filterable } = req.query;
        const query = {};

        if (is_variant !== undefined) query.is_variant = is_variant;
        if (is_filterable !== undefined) query.is_filterable = is_filterable;

        const attributes = await Attribute.find(query)
            .populate('values')
            .sort({ filter_order: 1, name: 1 });

        return res.status(200).json({
            success: true,
            data: attributes
        });

    } catch (err) {
        return res.status(500).json({
            success: false,
            message: 'Failed to fetch attributes',
            error: process.env.NODE_ENV === 'development' ? err.message : undefined
        });
    }
};