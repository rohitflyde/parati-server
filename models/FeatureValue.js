import mongoose from 'mongoose';

const featureValueSchema = new mongoose.Schema({
    // Core Fields
    feature_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Feature',
        required: true,
        index: true
    },
    product_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        index: true
    },
    variant_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Variant',
        index: true
    },
    value: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    },
    unit: {
        type: String,
        trim: true
    },

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

// Compound index for efficient querying
featureValueSchema.index({ feature_id: 1, product_id: 1 });
featureValueSchema.index({ feature_id: 1, variant_id: 1 });

// Validate value based on feature type
featureValueSchema.pre('save', function (next) {
    this.updated_at = Date.now();

    Feature.findById(this.feature_id).then(feature => {
        if (!feature) {
            throw new Error('Associated feature not found');
        }

        // Type validation
        switch (feature.input_type) {
            case 'boolean':
                if (typeof this.value !== 'boolean') {
                    throw new Error('Value must be boolean for this feature');
                }
                break;
            case 'range':
                if (typeof this.value !== 'number') {
                    throw new Error('Value must be a number for range feature');
                }
                if (feature.range_min !== undefined && this.value < feature.range_min) {
                    throw new Error(`Value cannot be less than ${feature.range_min}`);
                }
                if (feature.range_max !== undefined && this.value > feature.range_max) {
                    throw new Error(`Value cannot be greater than ${feature.range_max}`);
                }
                break;
            case 'select':
            case 'text':
                if (typeof this.value !== 'string') {
                    throw new Error('Value must be a string for this feature');
                }
                break;
        }
        next();
    }).catch(next);
});

const FeatureValue = mongoose.model('FeatureValue', featureValueSchema);
export default FeatureValue;