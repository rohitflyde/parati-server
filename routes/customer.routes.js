import express from "express";
import {
    createCustomer,
    getAllCustomers,
    getCustomerById,
    updateCustomer,
    deleteCustomer,
} from '../controllers/customer.controller.js'

import {protect, isAdmin} from '../middleware/authMiddleware.js'
const router = express.Router();

// Admin Routes
router.post("/", protect, isAdmin, createCustomer);
router.get("/", protect, isAdmin, getAllCustomers);
router.get("/:id", protect, isAdmin, getCustomerById);
router.put("/:id", protect, isAdmin, updateCustomer);
router.delete("/:id", protect, isAdmin, deleteCustomer);

export default router;
