import mongoose from "mongoose";
import Order from "../models/Order.js";
import Product from '../models/Product.js'
import Razorpay from 'razorpay';
import crypto from 'crypto';
import User from "../models/User.js";
import razorpay from "../utils/razorpay.js";
import { SendSMS } from '../utils/sendSMS.js'
import { sendEmail } from '../utils/sendEmail.js'
import { generateOrderEmail } from "../utils/orderEmailTemplate.js";
import { pushOrderToUnicommerce, fetchUnicommerceSaleOrder } from "../utils/unicommerece.js";
import {
  createShiprocketOrder,
  getShipmentTracking,
  generateInvoice,
  trackByAWB,
  getOrderDetails,
  generateManifest,
  getRecentShiprocketOrders,
  cancelShiprocketOrder as cancelShiprocketOrderControllers,

} from "../utils/shiprocket.js";
import { createLog } from "../utils/log.js";





/// Helpers
function formatDate(date) {
  return new Date(date).toISOString()
}



const validateStockAvailability = async (items) => {
  const stockErrors = [];
  const productUpdates = [];

  for (const item of items) {
    const product = await Product.findById(item.product);
    if (!product) {
      stockErrors.push(`Product not found: ${item.product}`);
      continue;
    }

    // Check if product has variants
    if (item.variant && item.variant !== "default") {
      const variant = product.variants?.find(v => v._id.toString() === item.variant);
      if (!variant) {
        stockErrors.push(`Variant not found for product: ${product.name}`);
        continue;
      }

      if (variant.inventory < item.quantity) {
        stockErrors.push(
          `Not enough stock for ${product.name} (${variant.sku || 'variant'}). Only ${variant.inventory} available, but ${item.quantity} requested`
        );
      } else {
        productUpdates.push({
          productId: product._id,
          variantId: item.variant,
          quantity: item.quantity,
          currentStock: variant.inventory
        });
      }
    } else {
      // Main product stock check
      if (product.stock < item.quantity) {
        stockErrors.push(
          `Not enough stock for ${product.name}. Only ${product.stock} available, but ${item.quantity} requested`
        );
      } else {
        productUpdates.push({
          productId: product._id,
          quantity: item.quantity,
          currentStock: product.stock
        });
      }
    }
  }

  return { stockErrors, productUpdates };
};


// Create Razorpay Order
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, orderId, paymentType = "full" } = req.body; // Add paymentType

    const options = {
      amount: Math.round(amount),
      currency: "INR",
      receipt: `order_${orderId}`,
      payment_capture: 1
    };

    const razorpayOrder = await razorpay.orders.create(options);

    // ✅ Update the order in database with the Razorpay order ID
    let updateData = {};
    if (paymentType === "cod_token") {
      updateData.razorpayTokenOrderId = razorpayOrder.id;
    } else {
      updateData.razorpayOrderId = razorpayOrder.id;
    }

    await Order.findByIdAndUpdate(orderId, updateData);

    await createLog({
      user: req.user?._id || null,
      source: "API",
      action: "CREATE_RAZORPAY_ORDER",
      entity: "Order",
      entityId: orderId,
      status: "SUCCESS",
      message: `Razorpay ${paymentType} order created successfully`,
      details: { options, razorpayOrder, paymentType },
      req,
    });

    res.status(200).json({
      success: true,
      order: razorpayOrder,
      paymentType
    });
  } catch (error) {
    console.error("❌ Razorpay Order Error:", error);

    await createLog({
      user: req.user?._id || null,
      source: "API",
      action: "CREATE_RAZORPAY_ORDER",
      entity: "Order",
      entityId: req.body?.orderId || null,
      status: "FAILURE",
      message: "Failed to create Razorpay order",
      details: { error: error.message },
      req,
    });

    res.status(500).json({
      error: true,
      message: "Failed to create Razorpay order"
    });
  }
};


// ✅ Verify Razorpay Payment
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {

      await createLog({
        user: req.user?._id || null,
        source: "API",
        action: "VERIFY_RAZORPAY_PAYMENT",
        entity: "Order",
        entityId: orderId,
        status: "FAILURE",
        message: "Payment verification failed: Signature mismatch",
        details: { razorpay_order_id, razorpay_payment_id },
        req,
      });

      return res.status(400).json({
        error: true,
        message: "Payment verification failed"
      });
    }

    // Get order before updating
    const order = await Order.findById(orderId).populate("items.product");
    if (!order) {

      await createLog({
        source: "API",
        action: "VERIFY_RAZORPAY_PAYMENT",
        entity: "Order",
        entityId: orderId,
        status: "FAILURE",
        message: "Order not found",
        details: { razorpay_order_id, razorpay_payment_id },
        req,
      });

      return res.status(404).json({ error: true, message: "Order not found" });
    }

    // ✅ Final stock validation before payment confirmation
    const { stockErrors } = await validateStockAvailability(order.items);
    if (stockErrors.length > 0) {
      // Refund the payment if stock is not available
      try {
        await razorpay.payments.refund(razorpay_payment_id, {
          amount: Math.round(order.total * 100)
        });
      } catch (refundError) {
        console.error("❌ Refund failed:", refundError);
      }

      await createLog({
        user: order.user || null,
        source: "API",
        action: "VERIFY_RAZORPAY_PAYMENT",
        entity: "Order",
        entityId: orderId,
        status: "FAILURE",
        message: "Stock unavailable. Payment refunded.",
        details: { stockErrors },
        req,
      });


      return res.status(400).json({
        error: true,
        message: "Stock unavailable. Payment refunded.",
        details: stockErrors
      });
    }

    // Update order status
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        status: "confirmed",
        paymentStatus: "completed",
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        isPaid: true,
        paidAt: new Date()
      },
      { new: true }
    ).populate("items.product").populate("user", "name email phone");

    // ✅ Deduct stock after successful payment
    for (const item of updatedOrder.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      if (item.variant && item.variant !== "default") {
        const variant = product.variants.id(item.variant);
        if (variant) {
          variant.inventory -= item.quantity;
          await product.save();
        }
      } else {
        product.stock -= item.quantity;
        await product.save();
      }
    }

    // 🔹 Log successful verification
    await createLog({
      user: updatedOrder.user?._id || null,
      source: "API",
      action: "VERIFY_RAZORPAY_PAYMENT",
      entity: "Order",
      entityId: updatedOrder._id,
      status: "SUCCESS",
      message: "Payment verified successfully and stock deducted",
      details: {
        razorpay_order_id,
        razorpay_payment_id,
        orderId: updatedOrder._id,
      },
      req,
    });



    // ✅ Push to Shiprocket
    try {
      const shiprocketRes = await createShiprocketOrder(updatedOrder);
      if (shiprocketRes && shiprocketRes.order_id) {
        await Order.findByIdAndUpdate(updatedOrder._id, {
          shiprocketOrderId: shiprocketRes.order_id,
          awbCode: shiprocketRes.awb_code || null,
          courierName: shiprocketRes.courier_name || null,
          trackingUrl: shiprocketRes.tracking_url || null
        });


        // 🔹 Log shiprocket success
        await createLog({
          user: updatedOrder.user?._id || null,
          source: "INTEGRATION",
          action: "PUSH_TO_SHIPROCKET",
          entity: "Order",
          entityId: updatedOrder._id,
          status: "SUCCESS",
          message: "Prepaid order pushed to Shiprocket",
          details: shiprocketRes,
        });

        console.log("✅ Prepaid order pushed to Shiprocket:", shiprocketRes.order_id);
      }
    } catch (err) {
      console.error("❌ Failed to push prepaid order to Shiprocket:", err.message);
      // 🔹 Log shiprocket failure
      await createLog({
        user: updatedOrder.user?._id || null,
        source: "INTEGRATION",
        action: "PUSH_TO_SHIPROCKET",
        entity: "Order",
        entityId: updatedOrder._id,
        status: "FAILURE",
        message: "Failed to push prepaid order to Shiprocket",
        details: { error: err.message },
      });
    }

    res.status(200).json({
      success: true,
      order: updatedOrder,
      message: "Payment verified successfully"
    });
  } catch (error) {
    console.error("❌ Payment Verification Error:", error);

    // 🔹 Log error
    await createLog({
      user: req.user?._id || null,
      source: "API",
      action: "VERIFY_RAZORPAY_PAYMENT",
      entity: "Order",
      entityId: req.body?.orderId || null,
      status: "FAILURE",
      message: "Failed to verify payment",
      details: { error: error.message },
      req,
    });


    res.status(500).json({
      error: true,
      message: "Failed to verify payment"
    });
  }
};



// ✅ Place Order
export const placeOrder = async (req, res) => {
  try {
    const { items, shippingAddress, paymentMethod, total } = req.body;
    const userId = req.user?._id;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      await createLog({
        user: null,
        source: "API",
        action: "PLACE_ORDER",
        entity: "Order",
        status: "FAILURE",
        message: "Invalid user ID while placing order",
        details: { userId },
        req,
      });
      return res.status(400).json({ error: true, message: "Invalid user ID" });
    }

    if (!items || !items.length) {
      await createLog({
        user: userId,
        source: "API",
        action: "PLACE_ORDER",
        entity: "Order",
        status: "FAILURE",
        message: "Cart is empty while placing order",
        details: {},
        req,
      });
      return res.status(400).json({ error: true, message: "Cart is empty" });
    }

    // ✅ Stock validation
    const { stockErrors } = await validateStockAvailability(items);
    if (stockErrors.length > 0) {
      await createLog({
        user: userId,
        source: "API",
        action: "PLACE_ORDER",
        entity: "Order",
        status: "FAILURE",
        message: "Stock validation failed while placing order",
        details: { stockErrors },
        req,
      });
      return res.status(400).json({
        error: true,
        message: "Stock validation failed",
        details: stockErrors,
      });
    }

    const user = await User.findById(userId);

    // ✅ Resolve shipping address
    let shippingAddressData;
    if (mongoose.Types.ObjectId.isValid(shippingAddress)) {
      const userAddress = user.addresses.id(shippingAddress);
      if (!userAddress) {
        await createLog({
          user: userId,
          source: "API",
          action: "PLACE_ORDER",
          entity: "Order",
          status: "FAILURE",
          message: "Address not found in user profile",
          details: { shippingAddress },
          req,
        });
        return res.status(400).json({ error: true, message: "Address not found" });
      }
      shippingAddressData = { ...userAddress.toObject(), name: user.name, email: user.email };
    } else {
      shippingAddressData = shippingAddress;
    }

    // ✅ Base order data
    const orderData = {
      user: userId,
      items: await Promise.all(
        items.map(async (item) => {
          const productDoc = await Product.findById(item.product).select("name sku basePrice");

          return {
            product: item.product,
            productName: productDoc?.name || "Unknown Product",
            sku: productDoc?.sku || item.product.toString(),
            quantity: item.quantity,
            price: item.price || productDoc?.basePrice || 0,
            variant: item.variant,
          };
        })
      ),

      shippingAddress: shippingAddressData,
      paymentMethod,
      total,
      status: "pending",
      paymentStatus: "pending",
      isPaid: false,
    };

    let razorpayOrder = null;

    // ✅ COD with Token
    if (paymentMethod === "cod") {
      orderData.tokenAmount = 1000;
      orderData.remainingCOD = total - 1000;
      orderData.tokenPaymentStatus = "pending";

      const options = {
        amount: orderData.tokenAmount * 100,
        currency: "INR",
        receipt: `cod_token_${Date.now()}`,
        payment_capture: 1,
      };

      razorpayOrder = await razorpay.orders.create(options);
      orderData.razorpayTokenOrderId = razorpayOrder.id;
    }

    // ✅ Razorpay Full Prepaid
    if (paymentMethod === "razorpay") {
      const options = {
        amount: total * 100,
        currency: "INR",
        receipt: `prepaid_${Date.now()}`,
        payment_capture: 1,
      };

      razorpayOrder = await razorpay.orders.create(options);
      orderData.razorpayOrderId = razorpayOrder.id;
    }

    const order = await Order.create(orderData);

    await createLog({
      user: userId,
      source: "API",
      action: "PLACE_ORDER",
      entity: "Order",
      entityId: order._id,
      status: "SUCCESS",
      message: "Order placed successfully",
      details: {
        paymentMethod,
        total,
        razorpayOrderId: razorpayOrder?.id || null,
      },
      req,
    });

    return res.status(201).json({
      success: true,
      message:
        paymentMethod === "cod"
          ? "COD order created. Token payment required."
          : "Prepaid order created. Proceed to payment.",
      order,
      razorpayOrder, // contains Razorpay order details for frontend checkout
      paymentRequired: true,
      paymentType: paymentMethod === "cod" ? "cod_token" : "razorpay",
    });
  } catch (err) {
    console.error("❌ Place Order Error:", err);
    await createLog({
      user: req.user?._id || null,
      source: "API",
      action: "PLACE_ORDER",
      entity: "Order",
      status: "FAILURE",
      message: "Failed to place order",
      details: { error: err.message },
      req,
    });
    return res.status(500).json({ error: true, message: err.message || "Failed to place order" });
  }
};





// ✅ Verify COD Token Payment
// export const verifyCodTokenPayment = async (req, res) => {
//   try {
//     const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

//     const generated_signature = crypto
//       .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
//       .update(`${razorpay_order_id}|${razorpay_payment_id}`)
//       .digest("hex");

//     if (generated_signature !== razorpay_signature) {
//       return res.status(400).json({ error: true, message: "Token payment verification failed" });
//     }

//     // Get order before updating
//     const order = await Order.findById(orderId).populate("items.product");
//     if (!order) {
//       return res.status(404).json({ error: true, message: "Order not found" });
//     }

//     // ✅ Final stock validation
//     const { stockErrors } = await validateStockAvailability(order.items);
//     if (stockErrors.length > 0) {
//       return res.status(400).json({
//         error: true,
//         message: "Stock unavailable",
//         details: stockErrors
//       });
//     }

//     const updatedOrder = await Order.findByIdAndUpdate(
//       orderId,
//       {
//         status: "confirmed",
//         tokenPaymentStatus: "paid",
//         razorpayTokenPaymentId: razorpay_payment_id,
//         razorpayTokenSignature: razorpay_signature
//       },
//       { new: true }
//     ).populate("items.product").populate("user", "name email phone");

//     // ✅ Deduct stock
//     for (const item of updatedOrder.items) {
//       const product = await Product.findById(item.product);
//       if (!product) continue;

//       if (item.variant && item.variant !== "default") {
//         const variant = product.variants.id(item.variant);
//         if (variant) {
//           variant.inventory -= item.quantity;
//           await product.save();
//         }
//       } else {
//         product.stock -= item.quantity;
//         await product.save();
//       }
//     }

//     // ✅ Push to Shiprocket
//     try {
//       const shiprocketRes = await createShiprocketOrder(updatedOrder);
//       if (shiprocketRes && shiprocketRes.order_id) {
//         await Order.findByIdAndUpdate(updatedOrder._id, {
//           shiprocketOrderId: shiprocketRes.order_id,
//           awbCode: shiprocketRes.awb_code || null,
//           courierName: shiprocketRes.courier_name || null,
//           trackingUrl: shiprocketRes.tracking_url || null
//         });
//         console.log("✅ COD order pushed to Shiprocket:", shiprocketRes.order_id);
//       }
//     } catch (err) {
//       console.error("❌ Failed to push COD order to Shiprocket:", err.message);
//     }

//     res.status(200).json({
//       success: true,
//       order: updatedOrder,
//       message: "COD token payment verified successfully"
//     });
//   } catch (err) {
//     console.error("❌ COD Token Payment Verification Error:", err);
//     res.status(500).json({ error: true, message: "Failed to verify COD token payment" });
//   }
// };



// ✅ Verify COD Token Payment
export const verifyCodTokenPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(body.toString())
      .digest("hex");

    if (expectedSignature !== razorpay_signature) {
      await createLog({
        user: req.user?._id || null,
        source: "API",
        action: "VERIFY_COD_TOKEN",
        entity: "Order",
        status: "FAILURE",
        message: "Invalid Razorpay signature for COD token payment",
        details: { razorpay_order_id, razorpay_payment_id },
        req,
      });
      return res.status(400).json({ error: true, message: "Invalid signature" });
    }

    const order = await Order.findOne({ razorpayTokenOrderId: razorpay_order_id }).populate("items.product");
    if (!order) {
      await createLog({
        user: req.user?._id || null,
        source: "API",
        action: "VERIFY_COD_TOKEN",
        entity: "Order",
        status: "FAILURE",
        message: "Order not found for Razorpay COD token",
        details: { razorpay_order_id },
        req,
      });
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    // ✅ FIX: Use consistent status "paid"
    order.tokenPaymentStatus = "paid";
    order.razorpayTokenPaymentId = razorpay_payment_id;
    order.tokenPaymentDate = new Date();

    await createLog({
      user: order.user,
      source: "API",
      action: "VERIFY_COD_TOKEN",
      entity: "Order",
      entityId: order._id,
      status: "SUCCESS",
      message: "COD token payment verified successfully",
      details: { razorpay_order_id, razorpay_payment_id },
      req,
    });

    // ✅ Stock validation
    const { stockErrors } = await validateStockAvailability(order.items);
    if (stockErrors.length > 0) {
      order.status = "cancelled";
      await order.save();

      await createLog({
        user: order.user,
        source: "API",
        action: "VERIFY_COD_TOKEN",
        entity: "Order",
        entityId: order._id,
        status: "FAILURE",
        message: "Stock validation failed after COD token payment",
        details: { stockErrors },
        req,
      });

      return res.status(400).json({
        error: true,
        message: "Stock validation failed",
        details: stockErrors
      });
    }

    // ✅ FIX: Use existing stock deduction logic instead of non-existent function
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;

      if (item.variant && item.variant !== "default") {
        const variant = product.variants.id(item.variant);
        if (variant) {
          variant.inventory -= item.quantity;
          await product.save();
        }
      } else {
        product.stock -= item.quantity;
        await product.save();
      }
    }

    order.status = "confirmed";
    await order.save();

    await createLog({
      user: order.user,
      source: "API",
      action: "VERIFY_COD_TOKEN",
      entity: "Order",
      entityId: order._id,
      status: "SUCCESS",
      message: "Order confirmed after COD token payment",
      details: { total: order.total, remainingCOD: order.remainingCOD },
      req,
    });

    // ✅ FIX: Use existing Shiprocket logic
    try {

      console.log("📦 Preparing Shiprocket order with items:", order.items.map(i => ({
        productName: i.productName,
        sku: i.sku,
        qty: i.quantity,
        price: i.price
      })));


      const shiprocketRes = await createShiprocketOrder(order);
      if (shiprocketRes?.order_id) {
        await Order.findByIdAndUpdate(order._id, {
          shiprocketOrderId: shiprocketRes.order_id,
          awbCode: shiprocketRes.awb_code,
          courierName: shiprocketRes.courier_name,
          trackingUrl: shiprocketRes.tracking_url
        });

        await createLog({
          user: order.user,
          source: "API",
          action: "SHIPROCKET_SYNC",
          entity: "Order",
          entityId: order._id,
          status: "SUCCESS",
          message: "Order pushed to Shiprocket after COD token verification",
          details: { shiprocketStatus: "pushed" },
          req,
        });
      }
    } catch (shiprocketErr) {
      console.error("❌ Failed to push COD order to Shiprocket:", shiprocketErr.message);
      await createLog({
        user: order.user,
        source: "API",
        action: "SHIPROCKET_SYNC",
        entity: "Order",
        entityId: order._id,
        status: "FAILURE",
        message: "Failed to push order to Shiprocket",
        details: { error: shiprocketErr.message },
        req,
      });
    }

    return res.status(200).json({
      success: true,
      message: "COD token payment verified successfully, order confirmed",
      order
    });
  } catch (error) {
    console.error("❌ Verify COD Token Payment Error:", error);
    await createLog({
      user: req.user?._id || null,
      source: "API",
      action: "VERIFY_COD_TOKEN",
      entity: "Order",
      status: "FAILURE",
      message: "Error verifying COD token payment",
      details: { error: error.message },
      req,
    });
    return res.status(500).json({ error: true, message: "Error verifying COD token payment" });
  }
};



// ✅ Razorpay Webhook

export const razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const body = req.body;

    // Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(body))
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error(":x: Invalid webhook signature");
      await createLog({
        source: "WEBHOOK",
        action: "RAZORPAY_WEBHOOK",
        entity: "Webhook",
        status: "FAILURE",
        message: "Invalid webhook signature",
        details: { signature, body },
      });
      return res.status(400).json({ error: true, message: "Invalid webhook signature" });
    }

    const event = body.event;
    console.log(`:bell: Webhook Received: ${event}`, body.payload);

    // Handle both payment.captured and order.paid events
    if (event === "payment.captured" || event === "order.paid") {
      let payment, orderId;

      if (event === "payment.captured") {
        payment = body.payload.payment.entity;
        orderId = payment.order_id;
        console.log(`:moneybag: Payment captured amount: ${payment.amount}`);
      } else if (event === "order.paid") {
        payment = body.payload.payment.entity;
        orderId = body.payload.order.entity.id;
        console.log(`:moneybag: Order paid amount: ${payment.amount}`);
      }

      // Log payment capture received
      await createLog({
        source: "WEBHOOK",
        action: event === "payment.captured" ? "PAYMENT_CAPTURED" : "ORDER_PAID",
        entity: "Order",
        status: "INFO",
        message: `Razorpay ${event} webhook received`,
        details: { payment, orderId, event },
      });

      // Find order by either razorpayOrderId OR razorpayTokenOrderId
      const order = await Order.findOne({
        $or: [
          { razorpayOrderId: orderId },
          { razorpayTokenOrderId: orderId }
        ]
      })
        .populate("items.product")
        .populate("user", "name email phone");


      // ✅ FIX: Use orderId instead of razorpayOrderId
      if (order && !order.razorpayTokenOrderId && order.paymentMethod === "cod") {
        await Order.findByIdAndUpdate(order._id, {
          razorpayTokenOrderId: orderId // ✅ Use orderId which contains the Razorpay order ID
        });
        console.log(`:wrench: Auto-fixed missing razorpayTokenOrderId for order: ${order._id}`);
      }

      if (!order) {
        console.warn(":warning: Order not found for Razorpay order_id:", orderId);
        await createLog({
          source: "WEBHOOK",
          action: event === "payment.captured" ? "PAYMENT_CAPTURED" : "ORDER_PAID",
          entity: "Order",
          status: "FAILURE",
          message: "Order not found for payment",
          details: { razorpay_order_id: orderId, event },
        });
        return res.json({ status: "ok" });
      }

      // Check if already processed
      if (order.paymentMethod === "cod" && order.tokenPaymentStatus === "paid") {
        console.log(":information_source: COD token already paid:", order._id);
        await createLog({
          source: "WEBHOOK",
          action: event === "payment.captured" ? "PAYMENT_CAPTURED" : "ORDER_PAID",
          entity: "Order",
          entityId: order._id,
          status: "INFO",
          message: "Payment already processed. Skipping duplicate webhook",
        });
        return res.json({ status: "ok" });
      }

      if (order.paymentMethod === "razorpay" && order.paymentStatus === "completed") {
        console.log(":information_source: Order already paid:", order._id);
        return res.json({ status: "ok" });
      }

      // Determine payment type
      const isCodTokenPayment =
        order.paymentMethod === "cod" &&
        orderId === order.razorpayTokenOrderId;

      const isFullPayment =
        order.paymentMethod === "razorpay" &&
        orderId === order.razorpayOrderId;

      console.log(`:moneybag: Payment Details:`, {
        orderId: order._id,
        paymentMethod: order.paymentMethod,
        isCodTokenPayment,
        isFullPayment,
        paymentAmount: payment.amount,
        expectedTokenAmount: order.tokenAmount * 100,
        event
      });

      let updateData = {
        razorpayPaymentId: payment.id,
        paidAt: new Date(),
        transactionDetails: payment
      };

      if (isCodTokenPayment) {
        // COD Token Payment
        updateData.tokenPaymentStatus = "paid";
        updateData.status = "confirmed";
        updateData.razorpayTokenPaymentId = payment.id;

        await createLog({
          user: order.user?._id || null,
          source: "WEBHOOK",
          action: "COD_TOKEN_PAYMENT",
          entity: "Order",
          entityId: order._id,
          status: "SUCCESS",
          message: "COD token payment successful via webhook",
          details: { payment, event },
        });
        console.log(`:white_tick: COD Token paid for order: ${order._id}`);
      } else if (isFullPayment) {
        // Full Prepaid Payment
        updateData.paymentStatus = "completed";
        updateData.isPaid = true;
        updateData.status = "confirmed";

        console.log(`:white_tick: Full payment received for order: ${order._id}`);
        await createLog({
          user: order.user?._id || null,
          source: "WEBHOOK",
          action: "FULL_PAYMENT",
          entity: "Order",
          entityId: order._id,
          status: "SUCCESS",
          message: "Full prepaid payment successful via webhook",
          details: { payment, event },
        });
      }

      // Update order
      const updatedOrder = await Order.findByIdAndUpdate(order._id, updateData, { new: true });

      // Deduct stock (both cases)
      for (const item of updatedOrder.items) {
        const product = await Product.findById(item.product);
        if (product) {
          if (product.stock < item.quantity) {
            console.error(`:x: Insufficient stock for ${product.name}`);
            continue;
          }
          product.stock -= item.quantity;
          await product.save();
        }
      }

      // Push to Shiprocket (both cases)
      try {

        console.log("📦 Preparing Shiprocket order with items:", order.items.map(i => ({
          productName: i.productName,
          sku: i.sku,
          qty: i.quantity,
          price: i.price
        })));

        const shiprocketRes = await createShiprocketOrder(updatedOrder);
        if (shiprocketRes?.order_id) {
          await Order.findByIdAndUpdate(updatedOrder._id, {
            shiprocketOrderId: shiprocketRes.order_id,
            awbCode: shiprocketRes.awb_code,
            courierName: shiprocketRes.courier_name,
            trackingUrl: shiprocketRes.tracking_url
          });
          console.log(":white_tick: Order pushed to Shiprocket:", shiprocketRes.order_id);
          await createLog({
            user: updatedOrder.user?._id || null,
            source: "INTEGRATION",
            action: "SHIPROCKET_PUSH",
            entity: "Order",
            entityId: updatedOrder._id,
            status: "SUCCESS",
            message: "Order pushed to Shiprocket via webhook",
            details: shiprocketRes,
          });
        }
      } catch (shiprocketErr) {
        console.error(":x: Shiprocket error:", shiprocketErr.message);
        await createLog({
          user: updatedOrder.user?._id || null,
          source: "INTEGRATION",
          action: "SHIPROCKET_PUSH",
          entity: "Order",
          entityId: updatedOrder._id,
          status: "FAILURE",
          message: "Failed to push order to Shiprocket",
          details: { error: shiprocketErr.message },
        });
      }

      // Send confirmation email/SMS
      try {
        if (updatedOrder.user?.email) {
          const emailTemplate = generateOrderEmail(updatedOrder);
          await sendEmail({
            to: updatedOrder.user.email,
            subject: `Order Confirmation - ${updatedOrder._id.toString().slice(-6).toUpperCase()}`,
            html: emailTemplate
          });
        }
        if (updatedOrder.shippingAddress?.phone) {
          const smsMessage = `Hi ${updatedOrder?.user?.name || "Customer"}, your order ${updatedOrder._id
            .toString()
            .slice(-6)
            .toUpperCase()} has been placed successfully on ${new Date().toLocaleDateString("en-IN")} via ExPro! We'll notify you once it's shipped. Thanks for shopping with us.`;
          await SendSMS({ phone: updatedOrder.shippingAddress.phone, message: smsMessage });
        }

        await createLog({
          user: updatedOrder.user?._id || null,
          source: "SERVICE",
          action: "ORDER_NOTIFICATION",
          entity: "Order",
          entityId: updatedOrder._id,
          status: "SUCCESS",
          message: "Email/SMS notifications sent",
        });
      } catch (notificationErr) {
        console.error(":x: Notification error:", notificationErr);
        await createLog({
          user: updatedOrder.user?._id || null,
          source: "SERVICE",
          action: "ORDER_NOTIFICATION",
          entity: "Order",
          entityId: updatedOrder._id,
          status: "FAILURE",
          message: "Failed to send notifications",
          details: { error: notificationErr.message },
        });
      }
    }

    // Handle payment failed event for both payment.failed and order.paid could have failed scenarios
    if (event === "payment.failed") {
      const payment = body.payload.payment.entity;
      const orderId = payment.order_id;

      const order = await Order.findOne({
        $or: [
          { razorpayOrderId: orderId },
          { razorpayTokenOrderId: orderId }
        ]
      });

      if (order) {
        if (orderId === order.razorpayTokenOrderId) {
          // COD token payment failed
          await Order.findByIdAndUpdate(order._id, {
            tokenPaymentStatus: "failed",
            status: "failed"
          });
        } else {
          // Full payment failed
          await Order.findByIdAndUpdate(order._id, {
            paymentStatus: "failed",
            status: "failed"
          });
        }
        console.log(`:x: Payment failed for order: ${order._id}`);
        await createLog({
          user: order.user?._id || null,
          source: "WEBHOOK",
          action: "PAYMENT_FAILED",
          entity: "Order",
          entityId: order._id,
          status: "FAILURE",
          message: "Razorpay payment failed",
          details: payment,
        });
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error(":x: Webhook processing error:", err);
    await createLog({
      source: "WEBHOOK",
      action: "RAZORPAY_WEBHOOK",
      entity: "Webhook",
      status: "FAILURE",
      message: "Webhook processing failed",
      details: { error: err.message },
    });
    res.status(500).json({ error: true, message: "Webhook processing failed" });
  }
};


export const syncSingleOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    let order = await Order.findById(orderId)
      .populate("items.product")
      .populate("user", "name email phone");
    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }
    // If already paid/confirmed, skip reprocessing
    if (order.isPaid && order.status === "confirmed") {
      return res.status(200).json({
        success: true,
        message: "Order already paid and confirmed",
        order,
      });
    }
    let razorpayOrderId = order.razorpayOrderId || order.razorpayTokenOrderId;
    // :arrows_anticlockwise: Retry path: search Razorpay if no ID saved
    if (!razorpayOrderId) {
      console.log(":warning: No Razorpay orderId in DB, searching Razorpay by description...");
      const from = Math.floor((Date.now() - 14 * 24 * 60 * 60 * 1000) / 1000); // last 14 days
      const to = Math.floor(Date.now() / 1000);
      const razorOrders = await razorpay.orders.all({ from, to });
      const matched = razorOrders.items.find(r =>
        r.notes?.mongoOrderId === order._id.toString() ||
        r.description?.includes(order._id.toString())
      );
      if (matched) {
        razorpayOrderId = matched.id;
        order.razorpayOrderId = matched.id;
        await order.save();
        await createLog({
          user: order.user?._id || null,
          source: "SYNC",
          action: "RAZORPAY_ORDER_RECOVERED",
          entity: "Order",
          entityId: order._id,
          status: "SUCCESS",
          message: "Recovered missing Razorpay order ID",
          details: matched,
          req,
        });
      } else {
        return res.status(400).json({
          error: true,
          message: "No matching Razorpay order found for this order",
        });
      }
    }
    // Fetch payments from Razorpay
    const cleanOrderId = razorpayOrderId
    const payments = await razorpay.orders.fetchPayments(cleanOrderId);
    if (!payments.items || payments.items.length === 0) {
      return res.status(400).json({ error: true, message: "No payments found in Razorpay" });
    }
    const payment = payments.items[0];
    if (payment.status !== "captured") {
      return res.status(400).json({
        error: true,
        message: `Payment not captured yet (status: ${payment.status})`,
      });
    }
    // :white_tick: Final stock validation before confirming
    const { stockErrors } = await validateStockAvailability(order.items);
    if (stockErrors.length > 0) {
      return res.status(400).json({
        error: true,
        message: "Stock unavailable for one or more items",
        details: stockErrors,
      });
    }
    // Update order as paid
    order.status = "confirmed";
    order.paymentStatus = "completed";
    order.isPaid = true;
    order.razorpayPaymentId = payment.id;
    order.paidAt = new Date(payment.created_at * 1000);
    await order.save();
    // Deduct stock
    for (const item of order.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;
      if (item.variant && item.variant !== "default") {
        const variant = product.variants.id(item.variant);
        if (variant) {
          variant.inventory -= item.quantity;
          await product.save();
        }
      } else {
        product.stock -= item.quantity;
        await product.save();
      }
    }
    await createLog({
      user: order.user?._id || null,
      source: "SYNC",
      action: "ORDER_CONFIRMED",
      entity: "Order",
      entityId: order._id,
      status: "SUCCESS",
      message: "Order confirmed and stock deducted via sync",
      details: { payment },
      req,
    });
    // Push to Shiprocket
    try {
      const shipRes = await createShiprocketOrder(order);
      if (shipRes?.order_id) {
        await Order.findByIdAndUpdate(order._id, {
          shiprocketOrderId: shipRes.order_id,
          awbCode: shipRes.awb_code || null,
          courierName: shipRes.courier_name || null,
          trackingUrl: shipRes.tracking_url || null,
        });
        await createLog({
          user: order.user?._id || null,
          source: "INTEGRATION",
          action: "SHIPROCKET_SYNC",
          entity: "Order",
          entityId: order._id,
          status: "SUCCESS",
          message: "Order synced to Shiprocket from single sync",
          details: shipRes,
        });
      }
    } catch (err) {
      console.error(":x: Shiprocket sync failed:", err.message);
      await createLog({
        user: order.user?._id || null,
        source: "INTEGRATION",
        action: "SHIPROCKET_SYNC",
        entity: "Order",
        entityId: order._id,
        status: "FAILURE",
        message: "Failed to sync order to Shiprocket",
        details: { error: err.message },
      });
    }
    res.status(200).json({
      success: true,
      message: "Order synced successfully",
      order,
      payment,
    });
  } catch (err) {
    console.error(":x: Sync Single Order Error:", err);
    await createLog({
      source: "SYNC",
      action: "SYNC_SINGLE_ORDER",
      entity: "Order",
      entityId: req.params.orderId || null,
      status: "FAILURE",
      message: "Failed to sync single order",
      details: { error: err.message },
      req,
    });
    res.status(500).json({ error: true, message: err.message });
  }
};




export const fixStuckOrders = async (req, res) => {
  try {
    console.log('🔄 Starting stuck orders fix...');

    const stuckOrders = await Order.find({
      $or: [
        {
          paymentMethod: "cod",
          tokenPaymentStatus: "pending",
          status: "pending"
        },
        {
          paymentMethod: "razorpay",
          paymentStatus: "pending",
          status: "pending"
        }
      ],
      createdAt: {
        $gte: new Date(Date.now() - 72 * 60 * 60 * 1000) // Last 72 hours
      }
    });

    console.log(`🔍 Found ${stuckOrders.length} pending orders`);

    let fixedCount = 0;
    let abandonedCount = 0;
    const fixedOrders = [];
    const abandonedOrders = [];
    const failedOrders = [];

    for (const order of stuckOrders) {
      try {
        console.log(`\n📦 Checking order: ${order._id}`);

        let razorpayOrderId = order.razorpayTokenOrderId || order.razorpayOrderId;

        if (razorpayOrderId) {
          const cleanOrderId = razorpayOrderId.replace('order_', '');

          try {
            const payments = await razorpay.orders.fetchPayments(cleanOrderId);

            if (payments.items && payments.items.length > 0) {
              const payment = payments.items[0];

              if (payment.status === "captured") {
                // ✅ REAL STUCK ORDER: Payment exists but not recorded
                await Order.findByIdAndUpdate(order._id, {
                  tokenPaymentStatus: "paid",
                  status: "confirmed",
                  razorpayTokenPaymentId: payment.id,
                  paidAt: new Date(payment.created_at * 1000)
                });

                fixedCount++;
                fixedOrders.push(order._id);
                console.log(`✅ Fixed stuck order: ${order._id}`);

              } else {
                // ⚠️ Payment exists but not captured
                abandonedCount++;
                abandonedOrders.push({
                  orderId: order._id,
                  razorpayOrderId: cleanOrderId,
                  paymentStatus: payment.status,
                  reason: "Payment initiated but not completed"
                });
                console.log(`⚠️ Abandoned order (payment ${payment.status}): ${order._id}`);
              }
            } else {
              // ❌ ABANDONED ORDER: No payment record exists
              abandonedCount++;
              abandonedOrders.push({
                orderId: order._id,
                razorpayOrderId: cleanOrderId,
                reason: "No payment record found - order abandoned"
              });
              console.log(`❌ Abandoned order (no payments): ${order._id}`);
            }
          } catch (razorpayError) {
            failedOrders.push({
              orderId: order._id,
              error: razorpayError.message
            });
            console.error(`❌ Razorpay error: ${razorpayError.message}`);
          }
        }
      } catch (err) {
        console.error(`❌ Error processing order ${order._id}:`, err);
        failedOrders.push({
          orderId: order._id,
          error: err.message
        });
      }
    }

    console.log(`\n📊 Fix completed:`);
    console.log(`   ✅ Fixed: ${fixedCount} actually paid orders`);
    console.log(`   ❌ Abandoned: ${abandonedCount} orders (no payment)`);
    console.log(`   🔧 Failed: ${failedOrders.length} orders`);

    res.json({
      success: true,
      summary: {
        totalChecked: stuckOrders.length,
        fixedCount,
        abandonedCount,
        failedCount: failedOrders.length
      },
      fixedOrders,
      abandonedOrders,
      failedOrders,
      message: abandonedCount > 0
        ? `Found ${abandonedCount} abandoned orders that need manual review`
        : `Processed ${stuckOrders.length} orders`
    });

  } catch (err) {
    console.error("❌ Fix Stuck Orders Error:", err);
    res.status(500).json({ error: true, message: err.message });
  }
};


// Add this temporary debug route
export const debugOrder = async (req, res) => {
  try {
    const { orderId } = req.params;

    const order = await Order.findById(orderId)
      .populate("items.product")
      .populate("user", "name email phone");

    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    console.log('🔍 Order Details:', {
      _id: order._id,
      paymentMethod: order.paymentMethod,
      tokenPaymentStatus: order.tokenPaymentStatus,
      status: order.status,
      razorpayTokenOrderId: order.razorpayTokenOrderId,
      razorpayTokenPaymentId: order.razorpayTokenPaymentId,
      createdAt: order.createdAt
    });

    // Check if we can fetch payment details from Razorpay
    let paymentDetails = null;
    if (order.razorpayTokenOrderId) {
      try {
        const payments = await razorpay.orders.fetchPayments(order.razorpayTokenOrderId);
        paymentDetails = payments;
        console.log('💰 Razorpay Payments:', payments);
      } catch (razorpayError) {
        console.error('❌ Razorpay Error:', razorpayError);
        paymentDetails = { error: razorpayError.message };
      }
    }

    res.json({
      order: {
        _id: order._id,
        paymentMethod: order.paymentMethod,
        tokenPaymentStatus: order.tokenPaymentStatus,
        status: order.status,
        razorpayTokenOrderId: order.razorpayTokenOrderId,
        razorpayTokenPaymentId: order.razorpayTokenPaymentId,
        total: order.total,
        tokenAmount: order.tokenAmount,
        createdAt: order.createdAt
      },
      razorpayPayments: paymentDetails
    });

  } catch (err) {
    console.error("❌ Debug Error:", err);
    res.status(500).json({ error: true, message: err.message });
  }
};


export const getAllOrders = async (req, res) => {
  try {
    const orders = await Order.find()
      .populate("user", "name email")
      .populate("items.product")
      .sort({ createdAt: -1 });

    res.status(200).json(orders);
  } catch (err) {
    console.error("❌ Get All Orders Error:", err);
    res.status(500).json({ error: true, message: "Failed to fetch orders" });
  }
};


export const getAllOrdersForSingleUser = async (req, res) => {
  try {
    const userId = req.user?._id;
    const { page = 1, limit = 10 } = req.query; // Default to page 1 and limit 10
    const skip = (page - 1) * limit;

    // Fetch orders for the user with pagination
    const orders = await Order.find({ user: userId })
      .skip(skip) // Skip orders for previous pages
      .limit(limit) // Limit the number of orders
      .populate({
        path: 'items.product',
        select: 'name featuredImage salePrice basePrice slug',
        populate: {
          path: 'featuredImage',
          model: 'Media',
          select: 'filePath',
        },
      })
      .sort({ createdAt: -1 });

    // Count total number of orders for the user (used for pagination calculation)
    const totalOrders = await Order.countDocuments({ user: userId });

    // Send response with pagination info and orders
    res.status(200).json({
      orders,
      totalOrders,
      totalPages: Math.ceil(totalOrders / limit),
      currentPage: parseInt(page),
    });
  } catch (err) {
    console.error("❌ Get All Orders Error:", err);
    res.status(500).json({
      error: true,
      message: err.message || "Failed to fetch orders",
    });
  }
};



export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id)
      .populate({
        path: 'items.product',
        populate: [
          { path: 'featuredImage', select: 'filePath' },
          { path: 'categories', select: 'title' },
          { path: 'brandId', select: 'name' }
        ]
      })
      .populate('shippingAddress') // if shippingAddress is a reference
      .lean();

    if (!order) {
      return res.status(404).json({
        error: true,
        message: 'Order not found'
      });
    }

    // Transform the order data for frontend
    const transformedOrder = {
      ...order,
      items: order.items.map(item => ({
        ...item,
        product: {
          ...item.product,
          title: item.product.name,
          featuredImg: item.product.featuredImage,
          category: item.product.categories?.[0]?.title || 'General',
          brand: item.product.brandId?.name || 'Unknown Brand',
          shortDescription: item.product.shortDescription || ''
        }
      }))
    };

    res.status(200).json(transformedOrder);
  } catch (err) {
    console.error('❌ Get Order By ID Error:', err);
    res.status(500).json({
      error: true,
      message: 'Failed to fetch order'
    });
  }
}


export const deleteOrderById = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    await Order.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Order deleted successfully",
    });
  } catch (err) {
    console.error("❌ Delete Order Error:", err);
    res.status(500).json({ error: true, message: "Failed to delete order" });
  }
};


export const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    console.log('param: ', id)
    console.log('status: ', status)

    const order = await Order.findByIdAndUpdate(
      id,
      { status },
      { new: true }
    )
      .populate('user', 'name email phone')
      .populate({
        path: 'items.product',
        model: 'Product', // Only needed if model name is not automatically inferred
      });


    if (!order) {
      return res.status(404).json({ error: true, message: 'Order not found' });
    }

    // ✅ Send SMS based on status
    try {
      const phone = order?.shippingAddress?.phone;
      const customerName = order?.user?.name || 'Customer';
      const orderIdShort = order._id.toString().slice(-6).toUpperCase();
      const shortOrderId = order._id.toString().slice(-6).toUpperCase();
      const productName = order?.items?.[0]?.product?.name || 'your product';
      const courier = order?.courierName || 'Shiprocket';
      const trackingUrl = order?.trackingUrl || 'https://itelshopindia.com';

      console.log('order: ', order)


      let message = '';

      switch (status) {
        case 'shipped':
          message = `Good news! Your ${productName} order ${shortOrderId} placed via ExPro has been shipped via ${courier}. Track here: ${trackingUrl}`;

          break;
        case 'delivered':
          message = `Hi ${customerName}, your order ${orderIdShort} has been delivered successfully. Thank you for shopping with ExPro!`;
          break;
        case 'cancelled':
          message = `Hi ${customerName}, your order ${orderIdShort} has been cancelled. If this was a mistake, please contact support.`;
          break;
        default:
          message = ''; // Don't send for other statuses like 'processing'
      }

      if (message) {
        await SendSMS({ phone, message });
        console.log(`📤 SMS sent for status ${status} to ${phone}`);
        console.log('message: ', message)
      }

    } catch (smsErr) {
      console.error(`❌ Failed to send SMS for status ${status}:`, smsErr.message);
    }

    res.status(200).json(order);
  } catch (err) {
    console.error('❌ Update Order Status Error:', err);
    res.status(500).json({ error: true, message: 'Failed to update order status' });
  }
};



export const getOrdersByUser = async (req, res) => {
  try {
    const { userId } = req.params;

    // Convert to ObjectId
    const objectId = new mongoose.Types.ObjectId(userId);

    const orders = await Order.find({ user: objectId })
      .populate({
        path: 'items.product',
        select: 'title price featuredImg'
      })
      .sort({ createdAt: -1 });

    res.status(200).json(orders);

  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({
      error: true,
      message: 'Failed to fetch orders'
    });
  }
}




// 🚀 Get Shiprocket Tracking
export const getShiprocketTracking = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    if (!order.shiprocketOrderId) {
      return res.status(400).json({ error: true, message: "Order not shipped yet" });
    }

    let trackingData;

    // Try tracking by AWB if available
    if (order.awbCode) {
      trackingData = await trackByAWB(order.awbCode);
    } else {
      // Fallback to order ID tracking
      trackingData = await getShipmentTracking(order.shiprocketOrderId);
    }

    // Update order with tracking info
    if (trackingData && trackingData.tracking_data) {
      const updateData = {
        shiprocketStatus: trackingData.tracking_data.shipment_status,
        trackingEvents: trackingData.tracking_data.track_activities || []
      };

      // Auto-update order status if delivered
      if (trackingData.tracking_data.shipment_status === 'Delivered') {
        updateData.status = 'delivered';
        updateData.deliveredAt = new Date();
      }

      await Order.findByIdAndUpdate(id, updateData);
    }

    res.status(200).json({
      success: true,
      tracking: trackingData
    });

  } catch (error) {
    console.error("❌ Get Tracking Error:", error);
    res.status(500).json({
      error: true,
      message: "Failed to fetch tracking details"
    });
  }
};

// 🚀 Download Invoice
export const downloadInvoice = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    if (!order.shiprocketOrderId) {
      return res.status(400).json({ error: true, message: "Order not shipped yet" });
    }

    // Generate invoice
    const invoiceData = await generateInvoice(order.shiprocketOrderId);

    // If invoice URL is returned, update order and redirect
    if (invoiceData.invoice_url) {
      await Order.findByIdAndUpdate(id, {
        invoiceUrl: invoiceData.invoice_url
      });

      return res.redirect(invoiceData.invoice_url);
    }

    res.status(200).json({
      success: true,
      invoice: invoiceData
    });

  } catch (error) {
    console.error("❌ Download Invoice Error:", error);
    res.status(500).json({
      error: true,
      message: "Failed to generate invoice"
    });
  }
};

// 🚀 Get Order Details from Shiprocket
export const getShiprocketOrderDetails = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    if (!order.shiprocketOrderId) {
      return res.status(400).json({ error: true, message: "Order not shipped yet" });
    }

    const orderDetails = await getOrderDetails(order.shiprocketOrderId);

    res.status(200).json({
      success: true,
      orderDetails: orderDetails
    });

  } catch (error) {
    console.error("❌ Get Order Details Error:", error);
    res.status(500).json({
      error: true,
      message: "Failed to fetch order details"
    });
  }
};

// 🚀 Download Shipping Label
export const downloadShippingLabel = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    if (!order.shiprocketOrderId) {
      return res.status(400).json({ error: true, message: "Order not shipped yet" });
    }

    const labelData = await generateShippingLabel(order.shiprocketOrderId);

    if (labelData.label_url) {
      await Order.findByIdAndUpdate(id, {
        labelUrl: labelData.label_url
      });

      return res.redirect(labelData.label_url);
    }

    res.status(200).json({
      success: true,
      label: labelData
    });

  } catch (error) {
    console.error("❌ Download Label Error:", error);
    res.status(500).json({
      error: true,
      message: "Failed to generate shipping label"
    });
  }
};

// 🚀 Generate Manifest
export const generateOrderManifest = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    if (!order.shiprocketOrderId) {
      return res.status(400).json({ error: true, message: "Order not shipped yet" });
    }

    const manifestData = await generateManifest(order.shiprocketOrderId);

    if (manifestData.manifest_url) {
      await Order.findByIdAndUpdate(id, {
        manifestUrl: manifestData.manifest_url
      });

      return res.redirect(manifestData.manifest_url);
    }

    res.status(200).json({
      success: true,
      manifest: manifestData
    });

  } catch (error) {
    console.error("❌ Generate Manifest Error:", error);
    res.status(500).json({
      error: true,
      message: "Failed to generate manifest"
    });
  }
};

// 🚀 Cancel Shiprocket Order
export const cancelShiprocketOrder = async (req, res) => {
  try {
    const { id } = req.params;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({ error: true, message: "Order not found" });
    }

    if (!order.shiprocketOrderId) {
      return res.status(400).json({ error: true, message: "Order not shipped yet" });
    }

    const cancelData = await cancelShiprocketOrderControllers(order.shiprocketOrderId);

    // Update order status
    await Order.findByIdAndUpdate(id, {
      status: 'cancelled',
      shiprocketStatus: 'CANCELLED'
    });

    res.status(200).json({
      success: true,
      message: "Order cancelled in Shiprocket",
      data: cancelData
    });

  } catch (error) {
    console.error("❌ Cancel Shiprocket Order Error:", error);
    res.status(500).json({
      error: true,
      message: "Failed to cancel order in Shiprocket"
    });
  }
};




export const auditRazorpayOrders = async (req, res) => {
  try {
    const { days = 30 } = req.query; // default last 30 days
    const from = Math.floor((Date.now() - days * 24 * 60 * 60 * 1000) / 1000);
    const to = Math.floor(Date.now() / 1000);

    // Fetch Razorpay orders
    const rzpOrders = await razorpay.orders.all({ from, to, count: 100 });
    const results = [];

    for (const rzpOrder of rzpOrders.items) {
      const dbOrder = await Order.findOne({
        $or: [
          { razorpayOrderId: rzpOrder.id },
          { razorpayTokenOrderId: rzpOrder.id },
        ],
      }).populate("user", "name email");

      results.push({
        razorpayOrderId: rzpOrder.id,
        amount: rzpOrder.amount / 100,
        currency: rzpOrder.currency,
        status: rzpOrder.status,
        createdAt: new Date(rzpOrder.created_at * 1000),
        email: rzpOrder.notes?.email || "-",
        dbOrderId: dbOrder?._id || null,
        dbStatus: dbOrder?.status || "NOT_FOUND",
        dbPaymentStatus: dbOrder?.paymentStatus || "unknown",
        dbUser: dbOrder?.user?.email || "-",
      });
    }

    res.json({ success: true, results });
  } catch (err) {
    console.error("❌ Audit Error:", err);
    res.status(500).json({ error: true, message: err.message });
  }
};





// export const auditShiprocketOrders = async (req, res) => {
//   try {
//     const { days = 30 } = req.query;
//     const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

//     // 🔹 Fetch recent orders from Shiprocket
//     const shipOrdersRes = await getRecentShiprocketOrders({ days });
//     // ⚠️ NOTE: If your utils don’t have this, you’ll need to call:
//     // GET https://apiv2.shiprocket.in/v1/external/orders?per_page=100&page=1&from=YYYY-MM-DD&to=YYYY-MM-DD

//     const results = [];

//     for (const srOrder of shipOrdersRes.data || []) {
//       const dbOrder = await Order.findOne({
//         shiprocketOrderId: srOrder.order_id,
//       }).populate("user", "name email");

//       results.push({
//         shiprocketOrderId: srOrder.order_id,
//         orderDate: srOrder.order_date,
//         status: srOrder.status,
//         amount: srOrder.order_amount,
//         courier: srOrder.courier_name || "-",
//         awb: srOrder.awb_code || "-",
//         dbOrderId: dbOrder?._id || null,
//         dbStatus: dbOrder?.status || "NOT_FOUND",
//         dbPaymentStatus: dbOrder?.paymentStatus || "unknown",
//         dbUser: dbOrder?.user?.email || "-",
//       });
//     }

//     res.json({ success: true, results });
//   } catch (err) {
//     console.error("❌ Shiprocket Audit Error:", err);
//     res.status(500).json({ error: true, message: err.message });
//   }
// };



export const auditShiprocketOrders = async (req, res) => {
  try {
    const { days = 30 } = req.query;
    const fromDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const from = fromDate.toISOString().split("T")[0];
    const to = new Date().toISOString().split("T")[0];
    const shipOrdersRes = await getRecentShiprocketOrders({ from, to, perPage: 100 });
    // Now loop over shipOrdersRes.data to compare with your DB orders...
    res.json(shipOrdersRes);
  } catch (err) {
    res.status(500).json({ error: true, message: err.message });
  }
};