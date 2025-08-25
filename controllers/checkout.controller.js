// controllers/checkoutController.js
import Order from '../models/Order.js';
import User from '../models/User.js';

export const guestCheckout = async (req, res) => {
    try {
        const userId = req.user.id;
        const { name, email, shippingAddress, items, total, paymentMethod } = req.body;

        // ✅ Validate required fields
        if (!name || !email || !shippingAddress || !items || !total || !paymentMethod) {
            return res.status(400).json({ message: "Missing required fields for checkout." });
        }

        // ✅ Update guest's basic info and push shipping address
        const user = await User.findById(userId);
        if (!user) return res.status(404).json({ message: "Guest user not found" });

        // Update only if not already present
        if (!user.name) user.name = name;
        if (!user.email) user.email = email;

        // Check for duplicate address
        const existing = user.addresses.find(
            addr =>
                addr.line1 === shippingAddress.line1 &&
                addr.pincode === shippingAddress.pincode &&
                addr.city === shippingAddress.city
        );

        if (!existing) user.addresses.push({ ...shippingAddress, isDefault: true });
        await user.save();

        // ✅ Create order
        const order = await Order.create({
            user: userId,
            items: items.map(i => ({
                product: i.product,
                quantity: i.quantity,
                price: i.price,
                variant: i.variant || ''
            })),
            shippingAddress: {
                ...shippingAddress,
                name,
                email
            },
            total,
            paymentMethod,
            status: 'processing',
            paymentStatus: 'pending',
            isPaid: false,
        });

        return res.status(201).json({
            success: true,
            message: "Order placed successfully",
            orderId: order._id
        });

    } catch (error) {
        console.error("❌ guestCheckout error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to place order",
            error: error.message
        });
    }
};
