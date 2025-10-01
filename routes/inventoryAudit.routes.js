// routes/inventoryAudit.js
import express from 'express';
import {
    getInventoryAudit,
    getRealTimeUpdates,
    getProductAudit
} from '../controllers/inventoryAudit.controller.js';
import { getInventoryMovements } from '../controllers/inventoryMovement.js';
import InventoryMovement from '../models/InventoryMovement.js';

const router = express.Router();


router.get("/inventory-movements", async (req, res) => {
    const { page = 1, limit = 50 } = req.query;
    const skip = (page - 1) * limit;
    const movements = await InventoryMovement.find()
        .populate("product", "name sku")
        .populate("user", "name email")
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit);
    const total = await InventoryMovement.countDocuments();
    res.json({
        success: true,
        total,
        page: Number(page),
        pages: Math.ceil(total / limit),
        movements,
    });
});


router.get('/dashboard', getInventoryAudit);
router.get('/realtime', getRealTimeUpdates);
router.get('/product/:productId', getProductAudit);
router.get("/products/:id/inventory-movements", getInventoryMovements);

export default router;