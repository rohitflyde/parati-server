import express from 'express';
import {
    createFeature,
    addFeatureValue,
    getCategoryFilters,
    applyFilters
} from '../controllers/feature.controller.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';

const router = express.Router();


// Admin Routes
router.post('/', protect, isAdmin, createFeature);
router.post('/values', protect, isAdmin, addFeatureValue);

// Public Routes
router.get('/filters/:category_id', getCategoryFilters);
router.post('/filters/:category_id/apply', applyFilters);

export default router;