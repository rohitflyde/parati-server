import mongoose from 'mongoose';
import slugify from 'slugify';

const attributeSchema = new mongoose.Schema({
    // Core Fields
    name: {
        type: String,
        required: [true, 'Attribute name is required'],
        trim: true,
        unique: true,
        maxlength: [50, 'Attribute name cannot exceed 50 characters']
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        index: true
    },
    input_type: {
        type: String,
        // enum: ['select', 'color', 'text', 'swatch'],
        default: 'select',
        required: true
    },

    // Display Properties
    display_name: {
        type: String,
        trim: true
    },
    is_variant: {
        type: Boolean,
        default: false,
        index: true
    },
    is_filterable: {
        type: Boolean,
        default: true,
        index: true
    },
    filter_order: {
        type: Number,
        default: 0
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

// Auto-generate slug
attributeSchema.pre('save', function (next) {
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
attributeSchema.virtual('values', {
    ref: 'AttributeValue',
    localField: '_id',
    foreignField: 'attribute_id'
});

// Indexes
attributeSchema.index({ name: 'text', display_name: 'text' });
attributeSchema.index({ slug: 1 });
attributeSchema.index({ is_variant: 1, is_filterable: 1 });

const Attribute = mongoose.model('Attribute', attributeSchema);
export default Attribute;