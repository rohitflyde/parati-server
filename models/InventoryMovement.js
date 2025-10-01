import mongoose from "mongoose";




const inventoryMovementSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
    type: {
        type: String,
        enum: ["add", "sale", "refund", "adjustment"],
        required: true
    },
    quantity: { type: Number, required: true },
    balance: { type: Number, required: true }, // :white_tick: running balance
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

export default  mongoose.model("InventoryMovement", inventoryMovementSchema);