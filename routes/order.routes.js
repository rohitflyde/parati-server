import express from "express";
import { createRazorpayOrder, getAllOrders, getAllOrdersForSingleUser, getOrderById, getOrdersByUser, placeOrder, updateOrderStatus, verifyRazorpayPayment } from '../controllers/order.controller.js'
import {protect} from '../middleware/authMiddleware.js'
const router = express.Router();




router.post('/create-razorpay-order', createRazorpayOrder)
router.post('/verify-payment', verifyRazorpayPayment)
router.post("/place",protect, placeOrder);
router.get('/:id', protect, getOrderById)
router.get('/', getAllOrders)
router.get('/customer/:userId', protect, getOrdersByUser)
router.get('/me/orders', protect, getAllOrdersForSingleUser)
router.patch('/update-order/:id', protect, updateOrderStatus)





export default router;
