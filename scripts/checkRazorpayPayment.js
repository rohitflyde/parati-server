// scripts/fixPendingOrders.js
import mongoose from "mongoose";
import Razorpay from "razorpay";
import dotenv from "dotenv";
import Order from "../models/Order.js";
import Product from "../models/Product.js";

dotenv.config();

// ✅ Connect to MongoDB
await mongoose.connect('mongodb+srv://rohit:Rohit254920@cluster0.fcwrazo.mongodb.net/parati?retryWrites=true&w=majority&appName=Cluster0', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

console.log("Connected to MongoDB");

// ✅ Initialize Razorpay
const razorpay = new Razorpay({
  key_id: 'rzp_live_REDEixrEmgEUpv',
  key_secret: 'ka5J23Rd9EzEZqSPincDAKvs',
});

const fixPendingOrders = async () => {
  try {
    const pendingOrders = await Order.find({
      paymentStatus: "pending",
      paymentMethod: { $in: ["razorpay", "cod"] },
    });

    console.log(`Found ${pendingOrders.length} pending orders`);

    for (const order of pendingOrders) {
      const razorpayId =
        order.paymentMethod === "cod"
          ? order.razorpayTokenOrderId
          : order.razorpayOrderId;

      if (!razorpayId) {
        console.log(`⚠️ No Razorpay ID for order: ${order._id}`);
        continue;
      }

      try {
        // Fetch payments by order_id
        const paymentsRes = await razorpay.orders.fetchPayments(razorpayId);

        if (!paymentsRes.items || paymentsRes.items.length === 0) {
          console.log(`⚠️ No payments found for order: ${order._id}`);
          continue;
        }

        // Find captured payment
        const capturedPayment = paymentsRes.items.find(
          (p) => p.status === "captured"
        );

        if (!capturedPayment) {
          console.log(`⚠️ Payment not captured yet for order: ${order._id}`);
          continue;
        }

        // ✅ Update order in DB
        const updatedOrder = await Order.findByIdAndUpdate(
          order._id,
          {
            paymentStatus: "completed",
            isPaid: true,
            status: "confirmed",
            paidAt: new Date(capturedPayment.created_at * 1000),
            razorpayPaymentId: capturedPayment.id,
          },
          { new: true }
        );

        console.log(`✅ Order updated: ${updatedOrder._id}`);

        // ✅ Deduct stock
        for (const item of updatedOrder.items) {
          const product = await Product.findById(item.product);
          if (!product) continue;
          if (product.stock >= item.quantity) {
            product.stock -= item.quantity;
            await product.save();
            console.log(`Stock deducted for product: ${product._id}`);
          } else {
            console.log(
              `⚠️ Not enough stock for ${product._id}. Only ${product.stock} left`
            );
          }
        }
      } catch (err) {
        console.error(`❌ Razorpay fetch error for order ${order._id}:`, err.message);
      }
    }

    console.log("✅ Finished processing all pending orders");
    process.exit(0);
  } catch (err) {
    console.error("❌ Script error:", err);
    process.exit(1);
  }
};

fixPendingOrders();
