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
  cancelShiprocketOrder as cancelShiprocketOrderControllers,

} from "../utils/shiprocket.js";





/// Helpers
function formatDate(date) {
  return new Date(date).toISOString()
}



// Create Razorpay Order
export const createRazorpayOrder = async (req, res) => {
  try {
    const { amount, orderId } = req.body;

    const options = {
      amount: Math.round(amount), // Amount in paise
      currency: "INR",
      receipt: `order_${orderId}`,
      payment_capture: 1 // Auto capture payment
    };

    const razorpayOrder = await razorpay.orders.create(options);

    res.status(200).json({
      success: true,
      order: razorpayOrder
    });
  } catch (error) {
    console.error("❌ Razorpay Order Error:", error);
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

    // Create signature
    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    // Verify signature
    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({
        error: true,
        message: "Payment verification failed"
      });
    }

    // Update order in database
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
    )
      .populate("items.product")
      .populate("user", "name email phone");

    // ✅ Deduct stock
    for (const item of updatedOrder.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;
      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: true,
          message: `Not enough stock for ${product.name}. Only ${product.stock} left`
        });
      }
      product.stock -= item.quantity;
      await product.save();
    }

    // ✅ Push to Shiprocket after payment success
    try {
      const populatedOrder = await Order.findById(updatedOrder._id).populate("items.product");
      const shiprocketRes = await createShiprocketOrder(populatedOrder);

      if (shiprocketRes && shiprocketRes.order_id) {
        await Order.findByIdAndUpdate(updatedOrder._id, {
          shiprocketOrderId: shiprocketRes.order_id,
          awbCode: shiprocketRes.awb_code || null,
          courierName: shiprocketRes.courier_name || null,
          trackingUrl: shiprocketRes.tracking_url || null
        });

        console.log("✅ Prepaid order pushed to Shiprocket:", shiprocketRes.order_id);
      }
    } catch (err) {
      console.error("❌ Failed to push prepaid order to Shiprocket:", err.message);
    }

    res.status(200).json({
      success: true,
      order: updatedOrder,
      message: "Payment verified successfully"
    });
  } catch (error) {
    console.error("❌ Payment Verification Error:", error);
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
      return res.status(400).json({ error: true, message: "Invalid user ID" });
    }

    if (!items || !items.length) {
      return res.status(400).json({ error: true, message: "Cart is empty" });
    }

    const user = await User.findById(userId);

    let shippingAddressData;
    if (mongoose.Types.ObjectId.isValid(shippingAddress)) {
      const userAddress = user.addresses.id(shippingAddress);
      if (!userAddress) {
        return res.status(400).json({ error: true, message: "Address not found" });
      }

      shippingAddressData = {
        line1: userAddress.line1,
        line2: userAddress.line2,
        city: userAddress.city,
        state: userAddress.state,
        pincode: userAddress.pincode,
        country: userAddress.country,
        phone: userAddress.phone,
        name: user.name,
        email: user.email
      };
    } else {
      shippingAddressData = shippingAddress;
    }

    const orderData = {
      user: userId,
      items: items.map(item => ({
        product: item.product,
        quantity: item.quantity,
        price: item.price,
        variant: item.variant
      })),
      shippingAddress: shippingAddressData,
      paymentMethod,
      total,
      status: "pending", // initially pending
      paymentStatus: "pending",
      isPaid: false
    };

    // ✅ COD Flow with Token
    if (paymentMethod === "cod") {
      orderData.tokenAmount = 1000;
      orderData.remainingCOD = total - 1000;
      orderData.tokenPaymentStatus = "pending";

      // Razorpay order for token payment (1000 INR)
      const options = {
        amount: 1000 * 100, // in paise
        currency: "INR",
        receipt: `cod_token_${Date.now()}`,
        payment_capture: 1
      };

      const razorpayOrder = await razorpay.orders.create(options);
      orderData.razorpayTokenOrderId = razorpayOrder.id;
    }

    // ✅ Razorpay (full payment) flow
    if (paymentMethod === "razorpay") {
      orderData.status = "processing";
      orderData.paymentStatus = "pending";
      orderData.isPaid = false;
    }

    const order = await Order.create(orderData);

    return res.status(201).json({
      success: true,
      message:
        paymentMethod === "cod"
          ? "COD order created. Token payment required."
          : "Order created. Proceed to payment.",
      order,
      paymentRequired: true,
      paymentType: paymentMethod === "cod" ? "cod_token" : "razorpay"
    });
  } catch (err) {
    console.error("❌ Place Order Error:", err);
    return res.status(500).json({
      error: true,
      message: err.message || "Failed to place order"
    });
  }
};



// ✅ Verify COD Token Payment
export const verifyCodTokenPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    const generated_signature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest("hex");

    if (generated_signature !== razorpay_signature) {
      return res.status(400).json({ error: true, message: "Token payment verification failed" });
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      {
        status: "confirmed",
        tokenPaymentStatus: "paid",
        razorpayTokenPaymentId: razorpay_payment_id,
        razorpayTokenSignature: razorpay_signature
      },
      { new: true }
    ).populate("items.product").populate("user", "name email phone");

    // ✅ Deduct stock
    for (const item of updatedOrder.items) {
      const product = await Product.findById(item.product);
      if (!product) continue;
      if (product.stock < item.quantity) {
        return res.status(400).json({
          error: true,
          message: `Not enough stock for ${product.name}. Only ${product.stock} left`
        });
      }
      product.stock -= item.quantity;
      await product.save();
    }

    // ✅ Push COD order to Shiprocket after token paid
    try {
      const populatedOrder = await Order.findById(updatedOrder._id).populate("items.product");
      const shiprocketRes = await createShiprocketOrder(populatedOrder);

      if (shiprocketRes && shiprocketRes.order_id) {
        await Order.findByIdAndUpdate(updatedOrder._id, {
          shiprocketOrderId: shiprocketRes.order_id,
          awbCode: shiprocketRes.awb_code || null,
          courierName: shiprocketRes.courier_name || null,
          trackingUrl: shiprocketRes.tracking_url || null
        });

        console.log("✅ COD order pushed to Shiprocket:", shiprocketRes.order_id);
      }
    } catch (err) {
      console.error("❌ Failed to push COD order to Shiprocket:", err.message);
    }


    // Send notifications
    try {
      const smsMessage = `Hi ${updatedOrder?.user?.name || "Customer"}, your order ${updatedOrder._id
        .toString()
        .slice(-6)
        .toUpperCase()} has been placed successfully on ${new Date().toLocaleDateString("en-IN")} via ExPro! We'll notify you once it's shipped. Thanks for shopping with us.`;

      await SendSMS({ phone: updatedOrder?.shippingAddress?.phone, message: smsMessage });


      const emailHtml = generateOrderEmail(updatedOrder);
      await sendEmail({
        to: updatedOrder.user.email,
        subject: `Order Confirmation #${updatedOrder._id.toString().slice(-6).toUpperCase()}`,
        html: emailHtml,
      });
    } catch (notifyErr) {
      console.error("⚠️ Failed to send notifications:", notifyErr.message);
    }

    res.status(200).json({
      success: true,
      order: updatedOrder,
      message: "COD token payment verified successfully"
    });
  } catch (err) {
    console.error("❌ COD Token Payment Verification Error:", err);
    res.status(500).json({ error: true, message: "Failed to verify COD token payment" });
  }
};


// ✅ Razorpay Webhook
export const razorpayWebhook = async (req, res) => {
  try {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    const signature = req.headers["x-razorpay-signature"];
    const body = req.body;

    // 🔑 Verify webhook signature
    const expectedSignature = crypto
      .createHmac("sha256", secret)
      .update(JSON.stringify(body))
      .digest("hex");

    if (expectedSignature !== signature) {
      console.error("❌ Invalid webhook signature");
      return res.status(400).json({ error: true, message: "Invalid webhook signature" });
    }

    const event = body.event;
    console.log(`🔔 Webhook Received: ${event}`);

    // ✅ PAYMENT CAPTURED - Main event
    if (event === "payment.captured") {
      const payment = body.payload.payment.entity;

      // Razorpay ke order_id se hi find karo
      const order = await Order.findOne({ razorpayOrderId: payment.order_id })
        .populate("items.product")
        .populate("user", "name email phone");

      if (!order) {
        console.warn("⚠️ Order not found for Razorpay order_id:", payment.order_id);
        return res.json({ status: "ok" });
      }

      // ✅ Check if already processed
      if (order.paymentStatus === "completed") {
        console.log("ℹ️ Order already paid:", order._id);
        return res.json({ status: "ok" });
      }

      // ✅ Determine payment type (COD Token vs Full Payment)
      const isCodTokenPayment =
        order.paymentMethod === "cod" && payment.amount === order.tokenAmount * 100;
      const isFullPayment = order.paymentMethod === "razorpay";

      let updateData = {
        razorpayPaymentId: payment.id,
        razorpayOrderId: payment.order_id,
        paidAt: new Date(),
        transactionDetails: payment
      };

      if (isCodTokenPayment) {
        // ✅ COD Token Payment
        updateData.tokenPaymentStatus = "paid";
        updateData.paymentStatus = "pending"; // COD balance still pending
        updateData.isPaid = false;
        updateData.status = "confirmed";

        console.log(`✅ COD Token paid for order: ${order._id}`);
      } else if (isFullPayment) {
        // ✅ Full Prepaid Payment
        updateData.paymentStatus = "completed";
        updateData.isPaid = true;
        updateData.status = "confirmed";

        console.log(`✅ Full payment received for order: ${order._id}`);
      }

      // ✅ Update order
      const updatedOrder = await Order.findByIdAndUpdate(order._id, updateData, { new: true });

      // ✅ Deduct stock (both cases)
      for (const item of updatedOrder.items) {
        const product = await Product.findById(item.product);
        if (product) {
          if (product.stock < item.quantity) {
            console.error(`❌ Insufficient stock for ${product.name}`);
            continue;
          }
          product.stock -= item.quantity;
          await product.save();
        }
      }

      // ✅ Push to Shiprocket (both cases)
      try {
        const shiprocketRes = await createShiprocketOrder(updatedOrder);
        if (shiprocketRes?.order_id) {
          await Order.findByIdAndUpdate(updatedOrder._id, {
            shiprocketOrderId: shiprocketRes.order_id,
            awbCode: shiprocketRes.awb_code,
            courierName: shiprocketRes.courier_name,
            trackingUrl: shiprocketRes.tracking_url
          });
          console.log("✅ Order pushed to Shiprocket:", shiprocketRes.order_id);
        }
      } catch (shiprocketErr) {
        console.error("❌ Shiprocket error:", shiprocketErr.message);
      }

      // ✅ Send confirmation email/SMS
      try {
        if (updatedOrder.user?.email) {
          const emailTemplate = generateOrderEmail(updatedOrder);
          await sendEmail({
            to: updatedOrder.user.email,
            subject: `Order Confirmation - ${updatedOrder._id}`,
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
      } catch (notificationErr) {
        console.error("❌ Notification error:", notificationErr);
      }
    }

    // ✅ PAYMENT FAILED event
    if (event === "payment.failed") {
      const payment = body.payload.payment.entity;

      const order = await Order.findOne({ razorpayOrderId: payment.order_id });
      if (order) {
        await Order.findByIdAndUpdate(order._id, {
          paymentStatus: "failed",
          status: "failed",
          transactionDetails: payment
        });
        console.log(`❌ Payment failed for order: ${order._id}`);
      }
    }

    res.json({ status: "ok" });
  } catch (err) {
    console.error("❌ Webhook processing error:", err);
    res.status(500).json({ error: true, message: "Webhook processing failed" });
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