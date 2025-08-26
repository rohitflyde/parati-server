import mongoose from 'mongoose';

const FeaturedItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    href: { type: String, required: true },
    imageSrc: { type: String, required: true },
    imageAlt: { type: String },
    colors: [{ type: String }]
});

const SectionItemSchema = new mongoose.Schema({
    name: { type: String, required: true },
    href: { type: String, required: true },
    desc: { type: String },
    image: { type: String }
});

const SectionSchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    items: [SectionItemSchema]
});

const CategorySchema = new mongoose.Schema({
    id: { type: String, required: true },
    name: { type: String, required: true },
    featured: [FeaturedItemSchema],
    sections: [[SectionSchema]]
});

const PageSchema = new mongoose.Schema({
    name: { type: String, required: true },
    href: { type: String, required: true }
});

const NavigationSchema = new mongoose.Schema({
    categories: [CategorySchema],
    pages: [PageSchema],
    isActive: { type: Boolean, default: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now }
});

export default mongoose.models.Navigation || mongoose.model('Navigation', NavigationSchema);