import express from 'express';
import {
    registerUser,
    loginUser,
    getProfile,
    updateProfile,
    getAllUsers,
    deleteUser,
    refreshToken,
    changePassword,
    verifyOtp,
    googleAuthHandler,
    sendOtpForUser,
    updateUserDetails,
    forgotPassword,
    verifyResetToken,
    resetPassword,
    verifyForgotOtp,
    resendForgotOtp,
} from '../controllers/user.controller.js';
import { protect, isAdmin } from '../middleware/authMiddleware.js'
import User from '../models/User.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);
router.post('/auth/google/callback', googleAuthHandler);


router.post('/send-otp', sendOtpForUser);
router.post('/verify-otp', verifyOtp);


// Forgot password OTP
router.post('/verify-forgot-otp', verifyForgotOtp);
router.post('/resend-forgot-otp', resendForgotOtp);

router.post('/refresh', refreshToken);
router.put('/change-password', protect, changePassword);
router.post('/forgot-password', forgotPassword)

router.get('/verify-reset-token/:token', verifyResetToken);

// Handle password reset
router.post('/reset-password', resetPassword);

// User profile routes
router.route('/profile')
    .get(protect, getProfile)
    .put(protect, updateProfile);


router.put('/me', protect, updateUserDetails);

// Admin routes
router.route('/')
    .get(protect, isAdmin, getAllUsers);

router.route('/:id')
    .delete(protect, isAdmin, deleteUser);

export default router;