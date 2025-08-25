import mongoose from "mongoose";



const otpSchema = new mongoose.Schema({
    email: {
        type: String,
        required: false // Changed to not required
    },
    phone: {
        type: String,
        required: false // Added phone field
    },
    otp: {
        type: String,
        required: true
    },
    expiresAt: {
        type: Date,
        default: () => new Date(Date.now() + 10 * 60 * 1000), // 10 minutes expiry
        index: { expires: 0 } // Auto-delete expired OTPs
    }
}, {
    timestamps: true
});

// Add compound index
otpSchema.index({ email: 1, phone: 1 }, { unique: true, sparse: true });

export default mongoose.model("OTP", otpSchema);