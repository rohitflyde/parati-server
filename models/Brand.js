import mongoose, { Schema } from "mongoose";

const brandSchema = new Schema({
    name: { type: String, required: true, unique: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: mongoose.Schema.Types.ObjectId, ref: "Media" }, // Image reference
    description: { type: String, default: "" },
    originCountry: { type: String, default: "" },
    officialSiteUrl: { type: String, default: "" },
    meta: {
        title: { type: String },
        description: { type: String },
        keywords: [{ type: String }],
    }
}, { timestamps: true });

export default mongoose.model("Brand", brandSchema);
