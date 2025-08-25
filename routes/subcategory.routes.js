import express from 'express';
import {
    createSubcategory, getAllSubcategories, getSubcategoryById, updateSubcategory, deleteSubcategory,
    checkSubcategorySlug,
    getSubcategoryBySlug
} from '../controllers/subcategory.controller.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';
import cloudinarUpload from '../middleware/uploadMiddleware.js';

const router = express.Router();

router.post("/", cloudinarUpload.single("img"), createSubcategory);
router.get('/', getAllSubcategories);
router.get('/check-slug', protect, isAdmin, checkSubcategorySlug)
router.get('/slug/:slug', getSubcategoryBySlug)
router.get('/:id', getSubcategoryById);
router.put('/:id', protect, isAdmin, updateSubcategory);
router.delete('/:id', protect, isAdmin, deleteSubcategory);

export default router;
