import mongoose from "mongoose";
const logSchema = new mongoose.Schema(
    {
        user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: false }, // optional
        source: {
            type: String,
            enum: ["API", "WEBHOOK", "SYSTEM", "JOB", "INTEGRATION", "SERVICE"],
            default: "API",
        },
        action: { type: String, required: true }, // e.g. CREATE_ORDER, VERIFY_PAYMENT, CANCEL_ORDER
        entity: { type: String, required: true }, // e.g. Order, Product, Webhook
        entityId: { type: mongoose.Schema.Types.ObjectId, required: false }, // ref id
        status: {
            type: String,
            enum: ["SUCCESS", "FAILURE", "INFO", "WARNING"],
            default: "INFO",
        },
        message: { type: String, default: "" }, // :white_tick: short human-readable summary
        details: { type: Object, default: {} }, // :white_tick: raw metadata / payload
        ipAddress: { type: String },
        userAgent: { type: String },
    },
    { timestamps: true }
);
export default mongoose.model("Log", logSchema);