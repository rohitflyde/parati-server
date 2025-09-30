// controllers/logController.js
import Log from "../models/Log.js";

export const getAllLogs = async (req, res) => {
    try {
        const { page = 1, limit = 20, status, action, userId } = req.query;
        const query = {};

        if (status) query.status = status.toUpperCase();
        if (action) query.action = action;
        if (userId) query.user = userId;

        const logs = await Log.find(query)
            .populate("user", "name email") // optional user info
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(Number(limit));

        const total = await Log.countDocuments(query);

        res.json({
            success: true,
            logs,
            pagination: {
                page: Number(page),
                limit: Number(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (err) {
        console.error("❌ Get Logs Error:", err);
        res.status(500).json({ success: false, message: "Failed to fetch logs" });
    }
};