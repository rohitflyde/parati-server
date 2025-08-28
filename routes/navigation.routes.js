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
            });
        }

        res.status(200).json({ success: true, data: navigation });
    } catch (error) {
        console.error("Error fetching navigation:", error);
        res.status(500).json({ success: false, message: "Error fetching navigation data" });
    }
});

// PUT update navigation (overwrite instead of creating new)
router.put("/", async (req, res) => {
    try {
        const { categories, pages } = req.body;

        if (!Array.isArray(categories)) {
            return res.status(400).json({ success: false, message: "Categories must be an array" });
        }

        // Update the active navigation OR create if not exists
        const navigation = await Navigation.findOneAndUpdate(
            { isActive: true },                       // condition
            { 
                categories, 
                pages: pages || [], 
                updatedAt: new Date() 
            }, 
            { new: true, upsert: true }               // return updated doc, create if not found
        );

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

// POST create new navigation (optional, keep if you want multiple history versions)
router.post("/", async (req, res) => {
    try {
        const { categories, pages } = req.body;

        const navigation = await Navigation.create({
            categories: categories || [],
            pages: pages || [],
            isActive: true,
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
