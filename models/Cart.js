import mongoose from 'mongoose';

const cartSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  tempCartId: { type: String },
  productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
  qty: { type: Number, default: 1 },
    isActive: { type: Boolean, default: true },
  selectedVariant: { type: String },
  reminderStage: { type: Number, default: 0 }, // Track which reminder we're on
  lastReminderAt: { type: Date }
}, { timestamps: true });

export default mongoose.model("Cart", cartSchema);
