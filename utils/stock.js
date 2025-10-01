import Product from "../models/Product.js";
import InventoryMovement from "../models/InventoryMovement.js";

const normalizedVariantId = variantId || null;


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
        const existing = await InventoryMovement.findOne({
            product: productId,
            variantId: normalizedVariantId,
            orderId,
            type: "sale"
        });

        if (existing) {
            // :white_tick: Already deducted – log duplicate attempt
            await InventoryMovement.create({
                product: productId,
                variantId: normalizedVariantId,
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
        product: productId,
            variantId: normalizedVariantId,
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