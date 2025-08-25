import mongoose, { Schema } from "mongoose";

const mediaSchema = new Schema({
    fileName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    fileSize: {
        type: Number,
        required: true
    },
    fileType: {
        type: String,
        required: true
    },
    title: {
        type: String,
        required: false
    },
    year: {
        type: Number,
        required: true
    },
    month: {
        type: Number,
        required: true
    },
    date: {
        type: Number,
        required: true
    },
    uploadedBy: {
        type: Schema.Types.ObjectId,
        ref: 'Users', // Make sure this matches the name of your user model
        required: true
    },
    createdAt: { type: Date, required: true, default: Date.now },
    updatedAt: { type: Date, required: true, default: Date.now },
});

const Media = mongoose.model('Media', mediaSchema);
export default Media