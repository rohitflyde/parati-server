// routes/pincode.js
import express from 'express';
import { lookupPincode } from '../controllers/location.controller.js';
const router = express.Router();

router.get('/lookup', lookupPincode);

export default router;
