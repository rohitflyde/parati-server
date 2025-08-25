import express from 'express'
import { guestCheckout } from '../controllers/checkout.controller.js';
import { protect } from '../middleware/authMiddleware.js';


const router = express.Router()

// routes/checkout.js
router.post('/guest', protect, guestCheckout);

export default router
