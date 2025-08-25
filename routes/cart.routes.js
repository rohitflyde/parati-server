import express from 'express'
import { addToCart, addToWishlist, deleteWishlistById, getCartItems, getWishlist, mergeCart } from '../controllers/cart.controller.js';
import { protect, optionalAuth } from '../middleware/authMiddleware.js';

const router = express.Router()

// Wishlist routes (require authentication)
router.get('/wishlist', protect, getWishlist)
router.post('/wishlist/add', protect, addToWishlist);
router.delete('/wishlist/remove', protect, deleteWishlistById)


router.post('/add', optionalAuth, addToCart);
router.get('/', optionalAuth, getCartItems);
router.post('/merge', protect, mergeCart);

export default router