import multer from 'multer';
import { storage } from '../utils/cloudinary.js';

const cloudinarUpload = multer({ storage });

export default cloudinarUpload;
