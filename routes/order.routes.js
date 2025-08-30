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
    deleteOrderById
} from '../controllers/order.controller.js'
import { isAdmin, protect } from '../middleware/authMiddleware.js'

const router = express.Router();

// ✅ Razorpay (full payment)
router.post('/create-razorpay-order', createRazorpayOrder)
router.post('/verify-payment', verifyRazorpayPayment)

// ✅ COD with Token Flow
router.post('/verify-cod-token', verifyCodTokenPayment) 

// ✅ Order Placement
router.post('/place', protect, placeOrder);

// ✅ Fetch Orders
router.get('/:id', protect, getOrderById)
router.get('/', getAllOrders)
router.get('/customer/:userId', protect, getOrdersByUser)
router.get('/me/orders', protect, getAllOrdersForSingleUser)

// ✅ Update + Delete
router.patch('/update-order/:id', protect, updateOrderStatus)
router.delete('/:id', protect, isAdmin, deleteOrderById)

export default router;
