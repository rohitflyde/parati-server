// Add to cart

import Cart from "../models/Cart.js";
import Wishlist from "../models/Wishlist.js";

import axios from 'axios';
import crypto from 'crypto';
import Product from '../models/Product.js';


const FB_PIXEL_ID = process.env.FB_PIXEL_ID;
const FB_ACCESS_TOKEN = process.env.FB_ACCESS_TOKEN;

console.log(FB_PIXEL_ID, FB_ACCESS_TOKEN)

function sha256Hash(str) {
    return crypto.createHash('sha256').update(str).digest('hex');
}


// export const addToCart = async (req, res) => {
//     try {
//         console.log(req.body)
//         const { productId, qty, tempCartId, selectedVariant } = req.body;
//         const userId = req.user ? req.user._id : null;
//         console.log('userid: ', userId)
//         if (!productId || !qty || (!userId && !tempCartId)) {
//             return res.status(400).json({ error: true, message: "Missing fields" });
//         }

//         const cartQuery = userId
//             ? { userId, productId, selectedVariant }
//             : { tempCartId, productId, selectedVariant };

//         let existingItem = await Cart.findOne(cartQuery);

//         if (existingItem) {
//             existingItem.qty += qty;
//             await existingItem.save();
//         } else {
//             await Cart.create({
//                 productId,
//                 qty,
//                 selectedVariant,
//                 ...(userId ? { userId } : { tempCartId }),
//             });
//         }

//         return res.status(200).json({ success: true, message: "Product added to cart" });
//     } catch (err) {
//         console.error("❌ Add to Cart Error:", err);
//         return res.status(500).json({ error: true, message: "Failed to add to cart" });
//     }
// };





// Updated Get cart items - both authenticated and unauthenticated


export const addToCart = async (req, res) => {
    try {
        const { productId, qty, tempCartId, selectedVariant } = req.body;
        const userId = req.user ? req.user._id : null;

        if (!productId || !qty || (!userId && !tempCartId)) {
            return res.status(400).json({ error: true, message: "Missing fields" });
        }

        const cartQuery = userId
            ? { userId, productId, selectedVariant }
            : { tempCartId, productId, selectedVariant };

        let existingItem = await Cart.findOne(cartQuery);

        if (existingItem) {
            existingItem.qty += qty;
            await existingItem.save();
        } else {
            await Cart.create({
                productId,
                qty,
                selectedVariant,
                ...(userId ? { userId } : { tempCartId }),
            });
        }

        // ✅ Send Meta CAPI AddToCart Event
        const product = await Product.findById(productId).select("name salePrice");

        if (product) {
            const eventPayload = {
                data: [
                    {
                        event_name: "AddToCart",
                        event_time: Math.floor(Date.now() / 1000),
                        action_source: "website",
                        event_source_url: req.headers.referer || "https://itel-frontend.vercel.app",
                        user_data: {
                            em: userId && req.user.email ? sha256Hash(req.user.email.toLowerCase()) : undefined,
                            ph: userId && req.user.phone ? sha256Hash(req.user.phone) : undefined,
                            client_ip_address: req.ip,
                            client_user_agent: req.headers["user-agent"],
                        },
                        custom_data: {
                            content_name: product.title,
                            content_ids: [productId],
                            content_type: "product",
                            value: product.salePrice * qty,
                            currency: "INR"
                        }
                    }
                ],
                access_token: FB_ACCESS_TOKEN,
                test_event_code: "TEST3970"
            };

            // Remove undefined keys
            Object.keys(eventPayload.data[0].user_data).forEach(key => {
                if (!eventPayload.data[0].user_data[key]) {
                    delete eventPayload.data[0].user_data[key];
                }
            });

            const fbEvent = await axios.post(
                `https://graph.facebook.com/v18.0/${FB_PIXEL_ID}/events`,
                eventPayload
            );

            console.log('fbEvent: ', fbEvent)
        }

        return res.status(200).json({ success: true, message: "Product added to cart" });

    } catch (err) {
        console.error("❌ Add to Cart Error:", err);
        return res.status(500).json({ error: true, message: "Failed to add to cart" });
    }
};







export const getCartItems = async (req, res) => {
    try {
        const { tempCartId } = req.query; // Get from query params instead of body
        const userId = req.user ? req.user._id : null;

        // Either userId or tempCartId should be present
        if (!userId && !tempCartId) {
            return res.status(400).json({ error: true, message: "Missing userId or tempCartId" });
        }

        const query = userId ? { userId } : { tempCartId };

        const cartItems = await Cart.find(query)
            .populate({
                path: "productId",
                select: "title slug sp featuredImg category",
                populate: [
                    { path: "category", select: "title" },
                    { path: "featuredImg", select: "filePath" }
                ]
            });

        return res.status(200).json({
            success: true,
            cart: cartItems,
        });
    } catch (err) {
        console.error("❌ Get Cart Items Error:", err);
        return res.status(500).json({
            success: false,
            message: "Failed to fetch cart items",
        });
    }
};

// Merge cart when user logs in
export const mergeCart = async (req, res) => {
    try {
        const { tempCartId } = req.body;
        const userId = req.user._id;

        if (!tempCartId) {
            return res.status(200).json({ success: true, message: "No temp cart to merge" });
        }

        // Get temp cart items
        const tempCartItems = await Cart.find({ tempCartId });

        for (const tempItem of tempCartItems) {
            // Check if item already exists in user's cart
            const existingItem = await Cart.findOne({
                userId,
                productId: tempItem.productId,
                selectedVariant: tempItem.selectedVariant
            });

            if (existingItem) {
                existingItem.qty += tempItem.qty;
                await existingItem.save();
            } else {
                // Create new item in user's cart
                await Cart.create({
                    userId,
                    productId: tempItem.productId,
                    qty: tempItem.qty,
                    selectedVariant: tempItem.selectedVariant
                });
            }

            // Delete temp cart item
            await Cart.findByIdAndDelete(tempItem._id);
        }

        return res.status(200).json({ success: true, message: "Cart merged successfully" });
    } catch (err) {
        console.error("❌ Merge Cart Error:", err);
        return res.status(500).json({ error: true, message: "Failed to merge cart" });
    }
};


// Wishlist
export const addToWishlist = async (req, res) => {
    try {
        const { userId, productId } = req.body;

        if (!userId || !productId) {
            return res.status(400).json({ error: true, message: "Missing userId or productId" });
        }

        const alreadyExists = await Wishlist.findOne({ userId, productId });
        if (alreadyExists) {
            return res.status(200).json({ success: true, message: "Already in wishlist" });
        }

        await Wishlist.create({ userId, productId });
        return res.status(200).json({ success: true, message: "Product added to wishlist" });
    } catch (err) {
        console.error("❌ Add to Wishlist Error:", err);
        return res.status(500).json({ error: true, message: "Failed to add to wishlist" });
    }
};
// Get wishlist items for a user
export const getWishlist = async (req, res) => {
    try {
        const userId = req.user?._id || req.query.userId;

        if (!userId) {
            return res.status(400).json({ error: true, message: "Missing userId" });
        }

        const wishlistItems = await Wishlist.find({ userId })
            .populate({
                path: "productId",
                populate: [
                    { path: "brandId", select: "name slug logo" },
                    { path: "categories", select: "title slug" },
                    { path: "featuredImage", select: "filePath" },
                    { path: "basePhotos", select: "filePath" } // ✅ Added this line
                ]
            });

        const products = wishlistItems
            .map((item) => item.productId)
            .filter(Boolean);

        return res.status(200).json({
            success: true,
            wishlist: products
        });

    } catch (err) {
        console.error("❌ Get Wishlist Error:", err);
        return res.status(500).json({ error: true, message: "Failed to fetch wishlist" });
    }
};

export const deleteWishlistById = async (req, res) => {
    try {
        const { productId } = req.body;
        console.log('prodId: ', productId)
        const userId = req.user?._id || req.query.userId;

        if (!userId || !productId) {
            return res.status(400).json({ error: true, message: "Missing userId or productId" });
        }

        const deleted = await Wishlist.findOneAndDelete({ userId, productId });

        if (!deleted) {
            return res.status(404).json({ error: true, message: "Item not found in wishlist" });
        }

        return res.status(200).json({ success: true, message: "Item removed from wishlist" });
    } catch (err) {
        console.error("❌ Delete Wishlist Error:", err);
        return res.status(500).json({ error: true, message: "Failed to remove item from wishlist" });
    }
};
