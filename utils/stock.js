import Product from "../models/Product.js";
import InventoryMovement from "../models/InventoryMovement.js";

export const reduceStock = async ({
    productId,
    variantId = null,
    quantity,
    orderId,
    userId,
    notes = ""
}) => {
    try {
        // :magnifying_glass_right: Step 1: Check if already deducted for this order + product + variant
        const existing = await InventoryLog.findOne({
            product: productId,
            variantId: variantId || null,
            orderId,
            type: "sale"
        });
        if (existing) {
            // :white_tick: Already deducted – log duplicate attempt
            await InventoryLog.create({
                product: productId,
                variantId,
                type: "duplicate_sale_attempt",
                quantity,
                balance: existing.balance, // keep balance unchanged
                orderId,
                user: userId,
                notes: `Duplicate stock deduction prevented. Original log: ${existing._id}. ${notes}`
            });
            return { success: false, message: "Duplicate deduction prevented" };
        }
        // :magnifying_glass_right: Step 2: Fetch product
        const product = await Product.findById(productId);
        if (!product) throw new Error("Product not found");
        let balance;
        if (variantId) {
            const variant = product.variants.id(variantId);
            if (!variant) throw new Error("Variant not found");
            if (variant.inventory < quantity) throw new Error("Insufficient stock");
            variant.inventory -= quantity;
            balance = variant.inventory;
        } else {
            if (product.stock < quantity) throw new Error("Insufficient stock");
            product.stock -= quantity;
            balance = product.stock;
        }
        await product.save();
        // :magnifying_glass_right: Step 3: Create proper inventory log
        await InventoryLog.create({
            product: productId,
            variantId,
            type: "sale",
            quantity,
            balance,
            orderId,
            user: userId,
            notes
        });
        return { success: true, message: "Stock reduced successfully" };
    } catch (err) {
        console.error(":x: reduceStock error:", err.message);
        throw err;
    }
};