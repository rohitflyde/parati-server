// controllers/brand.controller.js
import mongoose from "mongoose";
import Brand from "../models/Brand.js";
import { createMediaEntry } from "../utils/createMediaEntry.js";

// Create Brand
export const createBrand = async (req, res) => {
    try {
        const {
            name,
            slug,
            description,
            originCountry,
            officialSiteUrl,
            meta
        } = req.body;

        // Validate required fields
        if (!name || !slug) {
            return res.status(400).json({ message: "Name and slug are required" });
        }

        // Check if slug or name already exists
        const existing = await Brand.findOne({ $or: [{ name }, { slug }] });
        if (existing) return res.status(409).json({ message: "Brand with same name or slug already exists" });

        // Handle logo upload via multer/cloudinary if file present
        let logoId = null;
        if (req.file) {
            logoId = await createMediaEntry(req.file, req.user._id);
        }

        const brand = new Brand({
            name,
            slug,
            description,
            originCountry,
            officialSiteUrl,
            logo: logoId,
            meta
        });

        const savedBrand = await brand.save();
        res.status(201).json(savedBrand);

    } catch (err) {
        console.error("Create Brand Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get All Brands
export const getAllBrands = async (req, res) => {
    try {
        const brands = await Brand.find().populate("logo").sort({ createdAt: -1 }).exec();
        res.json(brands);
    } catch (err) {
        console.error("Get Brands Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get Brand by ID
export const getBrandById = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid Brand ID" });

        const brand = await Brand.findById(id).populate("logo").exec();
        if (!brand) return res.status(404).json({ message: "Brand not found" });

        res.json(brand);
    } catch (err) {
        console.error("Get Brand Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Update Brand by ID
export const updateBrand = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid Brand ID" });

        const updateData = { ...req.body };

        // If meta is sent as JSON string, parse it
        if (updateData.meta && typeof updateData.meta === "string") {
            updateData.meta = JSON.parse(updateData.meta);
        }

        // Handle logo update
        if (req.file) {
            const logoId = await createMediaEntry(req.file, req.user._id);
            updateData.logo = logoId;
        }

        const updatedBrand = await Brand.findByIdAndUpdate(id, updateData, { new: true, runValidators: true }).populate("logo");
        if (!updatedBrand) return res.status(404).json({ message: "Brand not found" });

        res.json(updatedBrand);
    } catch (err) {
        console.error("Update Brand Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Delete Brand by ID
export const deleteBrand = async (req, res) => {
    try {
        const { id } = req.params;
        if (!mongoose.isValidObjectId(id)) return res.status(400).json({ message: "Invalid Brand ID" });

        const deleted = await Brand.findByIdAndDelete(id);
        if (!deleted) return res.status(404).json({ message: "Brand not found" });

        // TODO: If needed, delete associated media or products referencing this brand

        res.json({ message: "Brand deleted successfully" });
    } catch (err) {
        console.error("Delete Brand Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};
