// models/Location.js
import mongoose from 'mongoose';

const locationSchema = new mongoose.Schema({
    pin: { type: String, required: true, unique: true },
    city: { type: String, required: true },
    state: { type: String, required: true },
    isServiceable: { type: Boolean, default: true }
});

export default mongoose.model("Location", locationSchema);
