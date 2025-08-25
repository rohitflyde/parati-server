import mongoose from 'mongoose';
import slugify from 'slugify';

const featureSchema = new mongoose.Schema({
    // Core Fields
    name: {
        type: String,
        required: [true, 'Feature name is required'],
        trim: true,
        maxlength: [100, 'Feature name cannot exceed 100 characters']
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        index: true
    },
    input_type: {
        type: String,
        enum: ['select', 'range', 'boolean', 'text'],
        default: 'select',
        required: true
    },

    // Filtering Properties
    is_filterable: {
        type: Boolean,
        default: true,
        index: true
    },
    filter_order: {
        type: Number,
        default: 0
    },
    filter_visibility: {
        type: String,
        enum: ['all', 'category', 'none'],
        default: 'all'
    },

    // Category Mapping
    category_ids: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Category',
        index: true
    }],

    // For Range Type
    range_min: Number,
    range_max: Number,
    range_step: {
        type: Number,
        default: 1
    },
    range_unit: String,

    // System
    created_at: {
        type: Date,
        default: Date.now
    },
    updated_at: {
        type: Date,
        default: Date.now
    }
}, {
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Auto-generate slug
featureSchema.pre('save', function (next) {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g
        });
    }
    next();
});

// Virtual for values
featureSchema.virtual('values', {
    ref: 'FeatureValue',
    localField: '_id',
    foreignField: 'feature_id'
});

// Indexes
featureSchema.index({ name: 'text' });
featureSchema.index({ slug: 1 });
featureSchema.index({ is_filterable: 1, filter_order: 1 });

const Feature = mongoose.model('Feature', featureSchema);
export default Feature;