// routes/admin.js
import express from "express";
import { isAdmin, protect } from "../middleware/authMiddleware.js";
import { getAllLogs } from "../controllers/logs.controller.js";

const router = express.Router();

router.get("/",protect, isAdmin, getAllLogs);

export default router;