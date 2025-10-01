// routes/inventoryAudit.js
import express from 'express';
import {
  getInventoryAudit,
  getRealTimeUpdates,
  getProductAudit
} from '../controllers/inventoryAudit.controller.js';
import { getInventoryMovements } from '../controllers/inventoryMovement.js';

const router = express.Router();

router.get('/dashboard', getInventoryAudit);
router.get('/realtime', getRealTimeUpdates);
router.get('/product/:productId', getProductAudit);
 router.get("/products/:id/inventory-movements", getInventoryMovements);

export default router;