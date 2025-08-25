import mongoose from 'mongoose';
import slugify from 'slugify';

const tagSchema = new mongoose.Schema({
    // Basic Information
    title: {
        type: String,
        required: [true, 'Tag title is required'],
        trim: true,
        unique: true,
        maxlength: [60, 'Tag title cannot exceed 60 characters']
    },
    slug: {
        type: String,
        unique: true,
        lowercase: true,
        index: true
    },
    description: {
        type: String,
        trim: true,
        maxlength: [160, 'Description cannot exceed 160 characters']
    },

    // Status and Visibility
    status: {
        type: Boolean,
        default: true,
        index: true
    },
    isFeatured: {
        type: Boolean,
        default: false,
        index: true
    },

    // SEO Metadata
    metaTitle: {
        type: String,
        trim: true,
        maxlength: [60, 'Meta title cannot exceed 60 characters']
    },
    metaDescription: {
        type: String,
        trim: true,
        maxlength: [160, 'Meta description cannot exceed 160 characters']
    },
    metaKeywords: [{
        type: String,
        trim: true
    }],

    // Media
    icon: {
        type: String, // Can store icon class or image URL
        trim: true
    },
    image: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Media'
    },

    // Relationships
    products: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product'
    }],
    relatedTags: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tag'
    }],

    // Analytics
    clickCount: {
        type: Number,
        default: 0
    },
    searchCount: {
        type: Number,
        default: 0
    },

    // System
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }
}, {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Auto-generate slug before saving
tagSchema.pre('save', function (next) {
    if (this.isModified('title')) {
        this.slug = slugify(this.title, {
            lower: true,
            strict: true,
            remove: /[*+~.()'"!:@]/g
        });
    }
    next();
});

// Indexes for better performance
tagSchema.index({ title: 'text', description: 'text' });
tagSchema.index({ slug: 1 });
tagSchema.index({ status: 1, isFeatured: 1 });

// Virtual for product count
tagSchema.virtual('productCount').get(function () {
    return this.products?.length || 0;
});

const Tag = mongoose.model('Tag', tagSchema);
export default Tag;