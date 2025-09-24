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
    debugOrder
} from '../controllers/order.controller.js'
import { isAdmin, protect } from '../middleware/authMiddleware.js'

const router = express.Router();

// ✅ Razorpay (full payment)
router.post('/create-razorpay-order', createRazorpayOrder)
router.post('/verify-payment', verifyRazorpayPayment)
router.post('/razorpay/webhook', express.raw({ type: "application/json" }),  razorpayWebhook)
router.get('/fix-razorpay-orders', fixStuckOrders) 
router.get('/debug/:orderId', debugOrder)

// ✅ COD with Token Flow
router.post('/verify-cod-token', verifyCodTokenPayment)

// ✅ Order Placement
router.post('/place', protect, placeOrder);


// Shiprocket
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

export default router;
