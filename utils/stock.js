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
    const normalizedVariantId = variantId || null;
    try {
        // Step 1: Try inserting log FIRST (unique index will block duplicates)
        const log = new InventoryMovement({
            product: productId,
            variantId: normalizedVariantId,
            type: "sale",
            quantity,
            balance: 0, // will update after stock deduction
            orderId,
            user: userId,
            notes
        });
        await log.save(); // :x: if duplicate, throws E11000 before stock change
        // Step 2: Deduct stock only if log was inserted successfully
        const product = await Product.findById(productId);
        if (!product) throw new Error("Product not found");
        let balance;
        if (normalizedVariantId) {
            const variant = product.variants.id(normalizedVariantId);
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
        // Step 3: Update balance in the movement log
        log.balance = balance;
        await log.save();
        return { success: true, message: "Stock reduced successfully" };
    } catch (err) {
        if (err.code === 11000) {
            // Mongo duplicate key error → duplicate prevented
            return { success: false, message: "Duplicate deduction prevented by DB" };
        }
        console.error(":x: reduceStock error:", err.message);
        throw err;
    }
};