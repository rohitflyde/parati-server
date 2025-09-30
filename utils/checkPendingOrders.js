// utils/checkPendingOrders.js
import Order from "../models/Order.js";
import razorpay from "../utils/razorpay.js";

export async function checkAndUpdatePendingOrders() {
    try {
        // Fetch all orders still marked as pending
        const pendingOrders = await Order.find({ status: "pending" });

        for (const order of pendingOrders) {
            if (!order.razorpay_order_id) continue; // skip if missing

            // Fetch payment(s) for this order from Razorpay
            const payments = await razorpay.orders.fetchPayments(order.razorpay_order_id);

            if (payments && payments.items && payments.items.length > 0) {
                const payment = payments.items[0]; // usually 1, but could be multiple

                if (payment.status === "captured") {
                    order.status = "paid";
                    order.payment_id = payment.id;
                } else if (["failed", "refunded"].includes(payment.status)) {
                    order.status = "failed";
                } else {
                    order.status = "pending"; // still unpaid
                }

                await order.save();
            }
        }

        console.log("Pending orders checked and updated.");
    } catch (error) {
        console.error("Error while checking pending orders:", error);
    }
}


export async function checkAndUpdateSingleOrder(orderId) {
    try {
        const order = await Order.findById(orderId);
        if (!order) {
            throw new Error("Order not found");
        }
        // pick razorpay orderId (you use both in controller)
        const razorpayOrderId = order.razorpayOrderId || order.razorpayTokenOrderId;
        if (!razorpayOrderId) {
            throw new Error("No Razorpay order ID found for this order");
        }
        // Fetch payments from Razorpay
        const payments = await razorpay.orders.fetchPayments(
            razorpayOrderId.replace("order_", "") // Razorpay API sometimes needs raw ID
        );
        if (payments && payments.items && payments.items.length > 0) {
            const payment = payments.items[0]; // usually one, but could be multiple
            if (payment.status === "captured") {
                order.status = "confirmed";
                order.paymentStatus = "completed";
                order.isPaid = true;
                order.razorpayPaymentId = payment.id;
                order.paidAt = new Date(payment.created_at * 1000);
            } else if (["failed", "refunded"].includes(payment.status)) {
                order.status = "failed";
                order.paymentStatus = "failed";
            } else {
                order.status = "pending";
                order.paymentStatus = "pending";
            }
            await order.save();
            return { success: true, order, payment };
        } else {
            return { success: false, message: "No payments found for this order" };
        }
    } catch (err) {
        console.error(":x: Error in checkAndUpdateSingleOrder:", err.message);
        return { success: false, error: err.message };
    }
}