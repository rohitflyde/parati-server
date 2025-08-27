import mongoose from "mongoose";
import Order from "../models/Order.js";
import Razorpay from 'razorpay';
import crypto from 'crypto';
import User from "../models/User.js";
import razorpay from "../utils/razorpay.js";
import { SendSMS } from '../utils/sendSMS.js'
import { sendEmail } from '../utils/sendEmail.js'
import { generateOrderEmail } from "../utils/orderEmailTemplate.js";
import { pushOrderToUnicommerce, fetchUnicommerceSaleOrder } from "../utils/unicommerece.js";





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

// Verify Razorpay Payment
export const verifyRazorpayPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, orderId } = req.body;

    // Create signature
    const generated_signature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');

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
        status: 'confirmed',
        paymentStatus: 'completed',
        razorpayOrderId: razorpay_order_id,
        razorpayPaymentId: razorpay_payment_id,
        razorpaySignature: razorpay_signature,
        isPaid: true,
        paidAt: new Date()
      },
      { new: true }
    )
      .populate('items.product')
      .populate('user', 'name email phone');

    // ✅ Send Order Confirmation SMS for Razorpay Payment
    try {
      const customerName = updatedOrder?.user?.name || 'Customer';
      const orderIdShort = updatedOrder?._id?.toString().slice(-6).toUpperCase(); // short order ID
      const orderDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const smsMessage = `Hi ${customerName}, your order ${orderIdShort} has been placed successfully on ${orderDate} via ExPro! We'll notify you once it's shipped. Thanks for shopping with us.`;

      await SendSMS({
        phone: updatedOrder?.shippingAddress?.phone,
        message: smsMessage
      });

      console.log(`✅ Order confirmation SMS sent to ${updatedOrder?.shippingAddress?.phone}`);


      try {
        // Generate email HTML
        const emailHtml = generateOrderEmail(updatedOrder);

        await sendEmail({
          to: updatedOrder.user.email,
          subject: `Your Itel Order #${updatedOrder._id.toString().slice(-6).toUpperCase()} Confirmation`,
          html: emailHtml
        });
      } catch (emailErr) {
        console.error('❌ Failed to send order confirmation email:', emailErr.message);
      }

      // try {
      //   await pushOrderToUnicommerce(updatedOrder);
      //   console.log("✅ Order synced with Unicommerce for Razorpay");
      // } catch (err) {
      //   console.error("⚠️ Failed to sync prepaid order with Unicommerce:", err.message);
      // }


    } catch (smsErr) {
      console.error('❌ Failed to send order confirmation SMS:', smsErr.message);
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

    // Get user to access address details if needed
    const user = await User.findById(userId);

    let shippingAddressData;

    // If shippingAddress is an ID (from saved addresses)
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
      // If shippingAddress is a new address object
      shippingAddressData = shippingAddress;
    }

    // Create order with initial status
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
      status: paymentMethod === 'cod' ? 'confirmed' : 'processing',
      paymentStatus: paymentMethod === 'cod' ? 'completed' : 'pending',
      isPaid: paymentMethod === 'cod' ? true : false
    };

    if (paymentMethod === 'cod') {
      orderData.paidAt = new Date();
    }

    const order = await Order.create(orderData);

    // For Razorpay, return minimal order for payment
    if (paymentMethod === 'razorpay') {
      return res.status(201).json({
        success: true,
        message: "Order created. Proceed to payment.",
        order,
        paymentRequired: true,
        paymentMethod: 'razorpay'
      });
    }

    // Populate full order details for COD
    const populatedOrder = await Order.findById(order._id)
      .populate({
        path: 'items.product',
        select: 'name sku price salePrice basePrice', // Try multiple possible price fields
        model: 'Product' // Explicitly specify the model
      })
      .populate('user', 'name email phone')
      .exec();
    console.log('populatedOrder: ', populatedOrder)


    // if (paymentMethod === 'cod') {
    //   try {
    //     await pushOrderToUnicommerce(populatedOrder);
    //     console.log("✅ Order synced with Unicommerce for COD");
    //   } catch (err) {
    //     console.error("⚠️ Failed to sync COD order with Unicommerce:", err.message);
    //   }
    // }


    // ✅ Send Order Confirmation SMS for COD
    try {
      const customerName = populatedOrder?.user?.name || 'Customer';
      const orderIdShort = populatedOrder?._id?.toString().slice(-6).toUpperCase(); // short order ID
      const orderDate = new Date().toLocaleDateString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });

      const smsMessage = `Hi ${customerName}, your order ${orderIdShort} has been placed successfully on ${orderDate} via ExPro! We'll notify you once it's shipped. Thanks for shopping with us.`;

      await SendSMS({
        phone: populatedOrder?.shippingAddress?.phone,
        message: smsMessage
      });

      console.log(`✅ Order confirmation SMS sent to ${populatedOrder?.shippingAddress?.phone}`);


      try {
        // Generate email HTML
        const emailHtml = generateOrderEmail(populatedOrder);

        await sendEmail({
          to: populatedOrder.user.email,
          subject: `Your Itel Order #${populatedOrder._id.toString().slice(-6).toUpperCase()} Confirmation`,
          html: emailHtml
        });






      } catch (emailErr) {
        console.error('❌ Failed to send order confirmation email:', emailErr.message);
      }
    } catch (smsErr) {
      console.error('❌ Failed to send order confirmation SMS:', smsErr.message);
    }

    return res.status(201).json({
      success: true,
      message: "COD order placed successfully",
      order: populatedOrder,
      paymentRequired: false
    });

  } catch (err) {
    console.error("❌ Place Order Error:", err);
    return res.status(500).json({
      error: true,
      message: err.message || "Failed to place order"
    });
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

    const orders = await Order.find({ user: userId })
      .populate({
        path: 'items.product',
        select: 'name featuredImage salePrice basePrice slug',
        populate: {
          path: 'featuredImage',
          model: 'Media',
          select: 'filePath'
        }
      })
      .sort({ createdAt: -1 });

    // Directly return orders without Unicommerce fetch
    res.status(200).json(orders);
  } catch (err) {
    console.error("❌ Get All Orders Error:", err);
    res.status(500).json({
      error: true,
      message: err.message || "Failed to fetch orders"
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
