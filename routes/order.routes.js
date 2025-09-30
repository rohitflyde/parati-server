import express from "express";
import {
    createRazorpayOrder,
    getAllOrders,
    getAllOrdersForSingleUser,
    getOrderById,
    getOrdersByUser,
    placeOrder,
    updateOrderStatus,
    verifyRazorpayPayment,
    verifyCodTokenPayment,   // ✅ new import
    deleteOrderById,
    getShiprocketTracking,
    downloadInvoice,
    getShiprocketOrderDetails,
    downloadShippingLabel,
    generateOrderManifest,
    cancelShiprocketOrder,
    razorpayWebhook,
    fixStuckOrders,
    debugOrder,
    syncSingleOrder,
    auditRazorpayOrders,
    auditShiprocketOrders
} from '../controllers/order.controller.js'
import { isAdmin, protect } from '../middleware/authMiddleware.js'
import { checkAndUpdatePendingOrders, checkAndUpdateSingleOrder } from "../utils/checkPendingOrders.js";
import Order from "../models/Order.js";
import { createShiprocketOrder } from "../utils/shiprocket.js";
import razorpay from "../utils/razorpay.js";
import Product from "../models/Product.js";

const router = express.Router();

// ✅ Razorpay (full payment)
router.get("/actions/sync-single/:orderId", syncSingleOrder);
router.get('/sync-razorpay-pending', protect, checkAndUpdatePendingOrders)
router.post('/create-razorpay-order', createRazorpayOrder)
router.post('/verify-payment', verifyRazorpayPayment)
router.post('/razorpay/webhook', express.raw({ type: "application/json" }), razorpayWebhook)
router.get('/fix-razorpay-orders', fixStuckOrders)
router.get('/debug/:orderId', debugOrder)

router.get("/audit/razorpay", auditRazorpayOrders);



// ✅ COD with Token Flow
router.post('/verify-cod-token', verifyCodTokenPayment)

// ✅ Order Placement
router.post('/place', protect, placeOrder);


// Shiprocket
router.get("/audit/shiprocket", auditShiprocketOrders);
router.get('/:id/shiprocket/tracking', getShiprocketTracking);
router.get('/:id/shiprocket/invoice', downloadInvoice);
router.get('/:id/shiprocket/details', getShiprocketOrderDetails);
router.get('/:id/shiprocket/label', downloadShippingLabel);
router.get('/:id/shiprocket/manifest', generateOrderManifest);
router.post('/:id/shiprocket/cancel', cancelShiprocketOrder);


// ✅ Fetch Orders
router.get('/:id', protect, getOrderById)
router.get('/', getAllOrders)
router.get('/customer/:userId', protect, getOrdersByUser)
router.get('/me/orders', protect, getAllOrdersForSingleUser)
// ✅ Update + Delete
router.patch('/update-order/:id', protect, updateOrderStatus)
router.delete('/:id', protect, isAdmin, deleteOrderById)


router.post("/:id/manual-capture", async (req, res) => {
    try {
        const { razorpayPaymentId } = req.body;
        const { id } = req.params;
        // 1. Fetch payment details from Razorpay
        const payment = await razorpay.payments.fetch(razorpayPaymentId);
        if (!payment || payment.status !== "captured") {
            return res.status(400).json({ message: "Invalid or uncaptured Razorpay payment." });
        }
        // 2. Find order in DB
        const order = await Order.findById(id);
        if (!order) {
            return res.status(404).json({ message: "Order not found." });
        }
        // 3. Attach Razorpay details
        order.payment_id = razorpayPaymentId;
        order.razorpayStatus = payment.status;
        order.isPaid = true;
        order.status = "confirmed";
        await order.save();
        // 4. Reduce inventory
        for (const item of order.items) {
            await Product.findByIdAndUpdate(item.product, {
                $inc: { stock: -item.quantity },
            });
        }
        // 5. Push to Shiprocket
        // (assuming you have a helper to create SR order)
        const shiprocketOrder = await createShiprocketOrder(order);
        order.shiprocketOrderId = shiprocketOrder?.order_id || null;
        await order.save();
        res.json({ success: true, order });
    } catch (err) {
        console.error("Manual capture error:", err);
        res.status(500).json({ message: "Error capturing payment manually." });
    }
});

export default router;
