import mongoose from "mongoose";




const inventoryMovementSchema = new mongoose.Schema({
    product: { type: mongoose.Schema.Types.ObjectId, ref: "Product", required: true },
    variantId: { type: mongoose.Schema.Types.ObjectId, ref: "Variant" },
    type: {
        type: String,
        enum: ["add", "sale", "refund", "adjustment", "duplicate_sale_attempt"],
        required: true
    },
    quantity: { type: Number, required: true },
    balance: { type: Number, required: true }, // :white_tick: running balance
    orderId: { type: mongoose.Schema.Types.ObjectId, ref: "Order" },
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    notes: String,
    createdAt: { type: Date, default: Date.now }
});

inventoryMovementSchema.index(
    { product: 1, variantId: 1, orderId: 1, type: 1 },
    { unique: true, partialFilterExpression: { type: "sale" } }
);

export default mongoose.model("InventoryMovement", inventoryMovementSchema);