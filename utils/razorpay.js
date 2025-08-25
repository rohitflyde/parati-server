// lib/razorpay.js
import Razorpay from 'razorpay';
import dotenv from 'dotenv';
dotenv.config();

console.log('🔐 RAZORPAY_KEY_ID from lib:', process.env.RAZORPAY_KEY_ID); // Debug

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
});

export default razorpay;
