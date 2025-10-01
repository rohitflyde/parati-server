import InventoryMovement from "../models/InventoryMovement.js";
import Product from "../models/Product.js";



export async function logInventoryMovement({
    productId,
    type,
    quantity,
    variantId = null,
    orderId = null,
    userId = null,
    notes = ""
}) {
    // Step 1: Get current stock
    let product = await Product.findById(productId);
    let currentStock;
    if (variantId) {
        const variant = product.variants.id(variantId);
        currentStock = variant.inventory;
    } else {
        currentStock = product.stock;
    }
    // Step 2: Calculate new balance
    let newBalance = currentStock;
    if (type === "add" || type === "refund") newBalance += quantity;
    if (type === "sale" || type === "adjustment") newBalance -= Math.abs(quantity);
    // Step 3: Insert movement log
    await InventoryMovement.create({
        product: productId,
        variantId,
        type,
        quantity,
        balance: newBalance,
        orderId,
        user: userId,
        notes
    });
    // Step 4: Update stock in Product
    if (variantId) {
        await Product.updateOne(
            { _id: productId, "variants._id": variantId },
            { $set: { "variants.$.inventory": newBalance } }
        );
    } else {
        await Product.findByIdAndUpdate(productId, { stock: newBalance });
    }
}


export const getInventoryMovements = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid product ID" });
    }

    const movements = await InventoryMovement.find({ product: id })
      .populate("user", "name email")
      .populate("orderId", "orderNumber status")
      .sort({ createdAt: -1 });

    return res.json({ movements });
  } catch (error) {
    console.error("Error fetching inventory movements:", error);
    res.status(500).json({ message: error.message });
  }
};
