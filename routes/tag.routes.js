import express from 'express';
import {
  createTag,
  getAllTags,
  getTagById,
  updateTag,
  deleteTag,
  searchTags
} from '../controllers/tag.controller.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js';
import cloudinaryUpload from '../middleware/uploadMiddleware.js'

const router = express.Router();

router.post(
  '/',
  protect,
  isAdmin,
  cloudinaryUpload.single('image'),
  createTag
);
router.get('/', getAllTags);
router.get('/search', searchTags);
router.get('/:id', getTagById);
router.put(
  '/:id',
  protect,
  isAdmin,
  cloudinaryUpload.single('image'),
  updateTag
);

router.delete('/:id', protect, isAdmin, deleteTag);

export default router;