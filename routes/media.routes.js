import express from 'express';
import {
    getAllMedia,
    getMediaById,
    deleteMedia,
    updateMediaTitle
} from '../controllers/media.controller.js';
import { isAdmin, protect } from '../middleware/authMiddleware.js';

const router = express.Router();

router.get('/', protect, isAdmin, getAllMedia); // /media?year=2025&month=7
router.get('/:id',protect, getMediaById);
router.delete('/:id', deleteMedia);
router.put('/:id/title', updateMediaTitle); // to update only title

export default router;
