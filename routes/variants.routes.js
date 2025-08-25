import express from 'express';
import {
    createVariant,
    getVariant,
    updateVariant
} from '../controllers/variant.controller.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';
import cloudinarUpload from '../middleware/uploadMiddleware.js';

const router = express.Router();



// Admin Routes
router.post('/', protect, isAdmin, cloudinarUpload.array('photos'), createVariant);
router.put('/:id', protect, isAdmin, updateVariant);

router.get('/:id', getVariant);

export default router;