// controllers/inventoryAuditController.js
import Order from "../models/Order.js";
import Product from "../models/Product.js";
import User from "../models/User.js";
import mongoose from "mongoose";

// 📊 Inventory Audit Dashboard
export const getInventoryAudit = async (req, res) => {
    try {
        const { timeframe = '7d' } = req.query; // 1d, 7d, 30d, all

        // Date range calculation
        const getDateRange = (timeframe) => {
            const now = new Date();
            switch (timeframe) {
                case '1d': return new Date(now.setDate(now.getDate() - 1));
                case '7d': return new Date(now.setDate(now.getDate() - 7));
                case '30d': return new Date(now.setDate(now.getDate() - 30));
                default: return new Date(0); // all time
            }
        };

        const startDate = getDateRange(timeframe);

        // 📈 Overall Statistics
        const totalProducts = await Product.countDocuments();
        const lowStockProducts = await Product.countDocuments({
            $or: [
                { stock: { $lt: 10 } },
                { 'variants.inventory': { $lt: 5 } }
            ]
        });

        // 🛒 Order Statistics
        const orderStats = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $in: ['confirmed', 'shipped', 'delivered'] }
                }
            },
            {
                $group: {
                    _id: null,
                    totalOrders: { $sum: 1 },
                    totalRevenue: { $sum: '$total' },
                    totalItemsSold: { $sum: { $size: '$items' } }
                }
            }
        ]);

        // 📦 Product-wise Sales Data - FIXED
        const productSales = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate },
                    status: { $in: ['confirmed', 'shipped', 'delivered'] }
                }
            },
            { $unwind: '$items' },
            {
                $lookup: {
                    from: 'products',
                    localField: 'items.product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $unwind: {
                    path: '$productDetails',
                    preserveNullAndEmptyArrays: true
                }
            },
            {
                $group: {
                    _id: '$items.product',
                    productName: {
                        $first: {
                            $ifNull: ['$items.productName', '$productDetails.name', 'Unknown Product']
                        }
                    },
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { totalSold: -1 } },
            { $limit: 20 }
        ]);

        // 🔄 Recent Stock Updates
        const recentStockUpdates = await Product.find({
            $or: [
                { updatedAt: { $gte: startDate } },
                { 'variants.updatedAt': { $gte: startDate } }
            ]
        })
            .select('name sku stock variants updatedAt')
            .sort({ updatedAt: -1 })
            .limit(50);

        // 🚚 Recent Orders with Details
        const recentOrders = await Order.find({
            createdAt: { $gte: startDate }
        })
            .populate('user', 'name email')
            .populate('items.product', 'name') // Populate product name
            .select('orderNumber items total status paymentStatus createdAt')
            .sort({ createdAt: -1 })
            .limit(20);

        // 📊 Stock Level Analysis
        const stockAnalysis = await Product.aggregate([
            {
                $project: {
                    name: 1,
                    sku: 1,
                    currentStock: '$stock',
                    status: {
                        $cond: {
                            if: { $lt: ['$stock', 10] },
                            then: 'LOW',
                            else: {
                                $cond: {
                                    if: { $lt: ['$stock', 25] },
                                    then: 'MEDIUM',
                                    else: 'HIGH'
                                }
                            }
                        }
                    }
                }
            },
            {
                $group: {
                    _id: '$status',
                    count: { $sum: 1 },
                    products: { $push: { name: '$name', sku: '$sku', stock: '$currentStock' } }
                }
            }
        ]);

        res.status(200).json({
            success: true,
            data: {
                timeframe,
                summary: {
                    totalProducts,
                    lowStockProducts,
                    totalOrders: orderStats[0]?.totalOrders || 0,
                    totalRevenue: orderStats[0]?.totalRevenue || 0,
                    totalItemsSold: orderStats[0]?.totalItemsSold || 0
                },
                topSellingProducts: productSales,
                recentStockUpdates,
                recentOrders,
                stockAnalysis,
                timestamp: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Inventory Audit Error:', error);
        res.status(500).json({
            error: true,
            message: 'Failed to fetch inventory audit data'
        });
    }
};

// 📈 Real-time Inventory Updates
export const getRealTimeUpdates = async (req, res) => {
    try {
        const lastHour = new Date(Date.now() - 60 * 60 * 1000);

        const recentActivities = await Order.find({
            updatedAt: { $gte: lastHour },
            status: { $in: ['confirmed', 'shipped'] }
        })
            .populate('user', 'name')
            .populate('items.product', 'name') // Populate product name
            .select('orderNumber items status updatedAt')
            .sort({ updatedAt: -1 });

        const stockChanges = await Product.find({
            updatedAt: { $gte: lastHour }
        })
            .select('name sku stock previousStock updatedAt')
            .sort({ updatedAt: -1 });

        res.status(200).json({
            success: true,
            data: {
                recentActivities,
                stockChanges,
                lastUpdated: new Date().toISOString()
            }
        });

    } catch (error) {
        console.error('❌ Real-time Updates Error:', error);
        res.status(500).json({
            error: true,
            message: 'Failed to fetch real-time updates'
        });
    }
};

// 🔍 Product-specific Audit Trail
export const getProductAudit = async (req, res) => {
    try {
        const { productId } = req.params;
        const { days = 30 } = req.query;

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - parseInt(days));

        // Product details
        const product = await Product.findById(productId)
            .select('name sku stock variants createdAt updatedAt');

        if (!product) {
            return res.status(404).json({
                error: true,
                message: 'Product not found'
            });
        }

        // Sales history for this product - FIXED
        const salesHistory = await Order.aggregate([
            {
                $match: {
                    'items.product': new mongoose.Types.ObjectId(productId),
                    createdAt: { $gte: startDate },
                    status: { $in: ['confirmed', 'shipped', 'delivered'] }
                }
            },
            { $unwind: '$items' },
            {
                $match: {
                    'items.product': new mongoose.Types.ObjectId(productId)
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    date: { $first: '$createdAt' },
                    totalSold: { $sum: '$items.quantity' },
                    totalRevenue: { $sum: { $multiply: ['$items.quantity', '$items.price'] } },
                    orderCount: { $sum: 1 }
                }
            },
            { $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 } }
        ]);

        // Recent orders containing this product
        const recentOrders = await Order.find({
            'items.product': productId,
            createdAt: { $gte: startDate }
        })
            .populate('user', 'name email')
            .populate('items.product', 'name') // Populate product name
            .select('orderNumber items quantity status createdAt')
            .sort({ createdAt: -1 })
            .limit(20);

        res.status(200).json({
            success: true,
            data: {
                product: {
                    _id: product._id,
                    name: product.name,
                    sku: product.sku,
                    stock: product.stock,
                    variants: product.variants,
                    createdAt: product.createdAt,
                    updatedAt: product.updatedAt
                },
                salesHistory,
                recentOrders,
                analysisPeriod: `${days} days`
            }
        });

    } catch (error) {
        console.error('❌ Product Audit Error:', error);
        res.status(500).json({
            error: true,
            message: 'Failed to fetch product audit data'
        });
    }
};