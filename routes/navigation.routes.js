// routes/navigation.js
import express from "express";
import Navigation from "../models/Navigation.js";

const router = express.Router();

// GET current navigation
router.get("/", async (req, res) => {
    try {
        let navigation = await Navigation.findOne({ isActive: true });

        // If no navigation exists, create default
        if (!navigation) {
            navigation = await Navigation.create({
                categories: [],
                pages: [],
                isActive: true,
                createdAt: new Date(),
                updatedAt: new Date()
            });
        }

        res.status(200).json({ success: true, data: navigation });
    } catch (error) {
        console.error("Error fetching navigation:", error);
        res.status(500).json({ success: false, message: "Error fetching navigation data" });
    }
});

// PUT update navigation
router.put("/", async (req, res) => {
    try {
        const { categories, pages } = req.body;

        console.log(req.body)

        if (!Array.isArray(categories)) {
            return res.status(400).json({ success: false, message: "Categories must be an array" });
        }

        // Deactivate current navigation
        await Navigation.updateMany({ isActive: true }, { isActive: false });

        // Create new navigation entry
        const navigation = await Navigation.create({
            categories,
            pages: pages || [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.status(200).json({
            success: true,
            message: "Navigation updated successfully",
            data: navigation
        });
    } catch (error) {
        console.error("Error updating navigation:", error);
        res.status(500).json({ success: false, message: "Error updating navigation data" });
    }
});

// POST create new navigation
router.post("/", async (req, res) => {
    try {
        const { categories, pages } = req.body;

        const navigation = await Navigation.create({
            categories: categories || [],
            pages: pages || [],
            isActive: true,
            createdAt: new Date(),
            updatedAt: new Date()
        });

        res.status(201).json({
            success: true,
            message: "Navigation created successfully",
            data: navigation
        });
    } catch (error) {
        console.error("Error creating navigation:", error);
        res.status(500).json({ success: false, message: "Error creating navigation data" });
    }
});

export default router;
