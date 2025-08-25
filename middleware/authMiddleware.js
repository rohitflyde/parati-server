import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export const protect = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id).select('-password');
            next();
        } catch (err) {
            console.error("❌ protect error:", err.message);
            return res.status(401).json({ message: 'Not authorized, token failed' });
        }
    } else {
        console.error("❌ protect: token missing");
        return res.status(401).json({ message: 'No token provided' });
    }
};

// Optional authentication - doesn't throw error if no token
export const optionalAuth = async (req, res, next) => {
    let token;

    if (req.headers.authorization?.startsWith('Bearer')) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            req.user = await User.findById(decoded.id).select('-password');
            console.log("✅ optionalAuth: User authenticated:", req.user._id);
        } catch (err) {
            console.log("⚠️ optionalAuth: Invalid token, continuing without user:", err.message);
            req.user = null;
        }
    } else {
        console.log("ℹ️ optionalAuth: No token provided, continuing without user");
        req.user = null;
    }

    next();
};

export const isAdmin = (req, res, next) => {
    console.log("🔍 isAdmin check for user:", req.user ? req.user._id : 'No user');
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        console.error("ERROR: Admin not found");
        res.status(403).json({ message: 'Admin access only' });
    }
};