import mongoose from "mongoose";

const orderSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    items: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: "Product" },
            quantity: Number,
            price: Number,
            variant: String
        },
    ],
    shippingAddress: {
        line1: { type: String, required: true },
        line2: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        pincode: { type: String, required: true },
        country: { type: String, default: 'India' },
        phone: { type: String, required: true },
        name: { type: String, required: true },
        email: { type: String }
    },
    paymentMethod: {
        type: String,
        enum: ['cod', 'razorpay'],
        required: true
    },
    total: { type: Number, required: true },
    status: {
        type: String,
        enum: ['pending', 'processing', 'confirmed', 'shipped', 'delivered', 'cancelled', 'failed'],
        default: "processing"
    },
    trackingUrl: { type: String },
    courierName: { type: String },
shippingMethod: {type: String},
    // Razorpay specific fields
    razorpayOrderId: String,
    razorpayPaymentId: String,
    razorpaySignature: String,
    paymentStatus: {
        type: String,
        enum: ['pending', 'completed', 'failed', 'refunded'],
        default: 'pending'
    },
    isPaid: {
        type: Boolean,
        default: false
    },
    paidAt: Date,
    transactionDetails: mongoose.Schema.Types.Mixed,

    courierName: { type: String },
    trackingUrl: { type: String },
}, {
    timestamps: true
});

export default mongoose.model("Order", orderSchema);