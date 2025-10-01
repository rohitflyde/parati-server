import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
const MONGO_URI = process.env.MONGO_URI || "mongodb+srv://rohit:Rohit254920@cluster0.fcwrazo.mongodb.net/parati?retryWrites=true&w=majority&appName=Cluster0";

async function auditDuplicateInventory() {
    await mongoose.connect(MONGO_URI);
    const since = new Date(Date.now() - 4 * 60 * 60 * 1000); // last 4 hours
    console.log(":magnifying_glass: Auditing orders since:", since);
    const orders = await Order.find({ createdAt: { $gte: since } }).populate("items.product");
    if (!orders.length) {
        console.log(":white_tick: No recent orders found");
        await mongoose.disconnect();
        return;
    }
    const corrections = [];
    for (const order of orders) {
        for (const item of order.items) {
            // Handle both populated and plain ObjectId
            const productId =
                item.product && typeof item.product === "object"
                    ? item.product._id
                    : item.product;
            if (!productId) {
                console.warn(`:warning: Skipping item in order ${order._id} - missing product`);
                continue;
            }
            const productDoc = await Product.findById(productId);
            if (!productDoc) {
                console.warn(`:warning: Product ${productId} not found for order ${order._id}`);
                continue;
            }
            // Check stock logs
            const saleLogs = productDoc.inventoryHistory.filter(
                (log) =>
                    log.type === "sale" &&
                    log.orderId?.toString() === order._id.toString() &&
                    (item.variant === "default"
                        ? !log.variantId
                        : log.variantId?.toString() === item.variant?.toString())
            );
            const deducted = saleLogs.reduce((sum, l) => sum + l.quantity, 0);
            if (deducted > item.quantity) {
                const excess = deducted - item.quantity;
                corrections.push({
                    orderId: order._id.toString(),
                    productId: productDoc._id.toString(),
                    productName: productDoc.name,
                    variantId: item.variant !== "default" ? item.variant?.toString() : null,
                    orderedQty: item.quantity,
                    deductedQty: deducted,
                    restoreNeeded: excess,
                });
            }
        }
    }
    if (corrections.length === 0) {
        console.log(":white_tick: No duplicate deductions detected");
    } else {
        console.log(":warning: Corrections needed:");
        console.table(corrections);
    }
    await mongoose.disconnect();
}
auditDuplicateInventory().catch((err) => {
    console.error(":x: Error:", err);
    process.exit(1);
});