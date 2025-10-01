import Product from "../models/Product.js";
import InventoryMovement from "../models/InventoryMovement.js";

export async function reduceStock({
    productId,
    quantity,
    variantId = null,
    orderId = null,
    userId = null,
    notes = "Stock deduction"
}) {
    const product = await Product.findById(productId);
    if (!product) {
        throw new Error(`Product not found: ${productId}`);
    }
    let balance;
    if (variantId) {
        const variant = product.variants.id(variantId);
        if (!variant) {
            throw new Error(`Variant not found: ${variantId}`);
        }
        // Deduct (but also allow duplicate deductions → log anyway)
        variant.inventory = Math.max(0, variant.inventory - quantity);
        balance = variant.inventory;
    } else {
        product.stock = Math.max(0, product.stock - quantity);
        balance = product.stock;
    }
    await product.save();
    // Always log, even if duplicate
    await InventoryMovement.create({
        product: product._id,
        variantId,
        orderId,
        type: "sale",
        quantity,
        balance,
        user: userId,
        notes
    });
    return { productId, variantId, newBalance: balance };
}