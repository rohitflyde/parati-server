



import mongoose from "mongoose";
import Razorpay from "razorpay";
import fs from "fs";
import { parse } from "json2csv";
import dotenv from "dotenv";
import Order from "../models/Order.js"; // adjust path if needed
dotenv.config();
// :white_tick: Razorpay Client
const razorpay = new Razorpay({
    key_id: 'rzp_live_REDEixrEmgEUpv',
    key_secret: 'ka5J23Rd9EzEZqSPincDAKvs',
});


// :white_tick: MongoDB Connection
async function connectDB() {
   
    
    await mongoose.connect('mongodb+srv://rohit:Rohit254920@cluster0.fcwrazo.mongodb.net/parati?retryWrites=true&w=majority&appName=Cluster0');
    console.log(":white_tick: MongoDB connected");
}
async function checkPayments() {
    try {
        // --- 1. Decide Date Range ---
        let from, to, label;
        const dateArg = process.argv[2]; // YYYY-MM-DD optional
        if (dateArg) {
            const targetDate = new Date(dateArg);
            if (isNaN(targetDate)) {
                console.error(":x: Invalid date format. Use YYYY-MM-DD");
                process.exit(1);
            }
            const startOfDay = new Date(targetDate.setHours(0, 0, 0, 0));
            const endOfDay = new Date(targetDate.setHours(23, 59, 59, 999));
            from = Math.floor(startOfDay.getTime() / 1000);
            to = Math.floor(endOfDay.getTime() / 1000);
            label = dateArg;
        } else {
            from = Math.floor((Date.now() - 30 * 24 * 60 * 60 * 1000) / 1000);
            to = Math.floor(Date.now() / 1000);
            label = "last_30_days";
        }
        console.log(`:date: Fetching captured payments for: ${label}`);
        // --- 2. Fetch Razorpay Payments ---
        const paymentsRes = await razorpay.payments.all({ from, to, count: 100 });
        const capturedPayments = paymentsRes.items.filter(
            (p) => p.status === "captured"
        );
        console.log(`:moneybag: Found ${capturedPayments.length} captured payments`);
        // --- 3. Compare with DB Orders ---
        const unsynced = [];
        for (const payment of capturedPayments) {
            const { id, order_id, email, created_at, amount } = payment;
            // Try to find order in DB
            const matchingOrder = await Order.findOne({
                $or: [
                    { razorpayOrderId: order_id },
                    { razorpayTokenOrderId: order_id },
                    { razorpayPaymentId: id },
                ],
            });
            if (!matchingOrder) {
                // Check if any pending order exists for same email
                let pendingOrders = [];
                if (email) {
                    pendingOrders = await Order.find({
                        "user.email": email,
                        status: "pending",
                    }).lean();
                }
                unsynced.push({
                    razorpayPaymentId: id,
                    razorpayOrderId: order_id,
                    amount: amount / 100, // INR
                    email: email || "N/A",
                    paymentDate: new Date(created_at * 1000).toISOString(),
                    pendingOrders: pendingOrders.map((o) => o._id).join(", ") || "None",
                });
            }
        }
        console.log(`:warning: Found ${unsynced.length} payments with no matching order`);
        // --- 4. Export CSV ---
        if (unsynced.length > 0) {
            const csv = parse(unsynced);
            const filePath = `./razorpay_audit_${label}.csv`;
            fs.writeFileSync(filePath, csv);
            console.log(`:open_file_folder: Report saved at: ${filePath}`);
        } else {
            console.log(":white_tick: All captured payments are synced with orders");
        }
    } catch (err) {
        console.error(":x: Error checking payments:", err);
    } finally {
        await mongoose.disconnect();
    }
}
await connectDB();
await checkPayments();