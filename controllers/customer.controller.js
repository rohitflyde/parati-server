import Customer from "../models/Customer.js";

// Create customer (by admin)
export const createCustomer = async (req, res) => {
    try {
        const { name, phone, email, address, pincode } = req.body;

        // Check duplicate
        const existing = await Customer.findOne({ phone });
        if (existing) {
            return res.status(400).json({ message: "Customer with this phone already exists." });
        }

        const newCustomer = await Customer.create({
            name,
            phone,
            email,
            address,
            pincode,
            createdBy: req.user?._id, // assuming you attach user in middleware
        });

        res.status(201).json({ message: "Customer created successfully", customer: newCustomer });
    } catch (err) {
        console.error("Create Customer Error:", err);
        res.status(500).json({ message: "Internal server error" });
    }
};

// Get all customers (admin panel)
export const getAllCustomers = async (req, res) => {
    try {
        const customers = await Customer.find().sort({ createdAt: -1 });
        res.json(customers);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch customers" });
    }
};

// Get single customer
export const getCustomerById = async (req, res) => {
    try {
        const customer = await Customer.findById(req.params.id);
        if (!customer) return res.status(404).json({ message: "Customer not found" });

        res.json(customer);
    } catch (err) {
        res.status(500).json({ message: "Error fetching customer" });
    }
};

// Update customer
export const updateCustomer = async (req, res) => {
    try {
        const updated = await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true });
        res.json({ message: "Customer updated", customer: updated });
    } catch (err) {
        res.status(500).json({ message: "Error updating customer" });
    }
};

// Delete customer
export const deleteCustomer = async (req, res) => {
    try {
        await Customer.findByIdAndDelete(req.params.id);
        res.json({ message: "Customer deleted" });
    } catch (err) {
        res.status(500).json({ message: "Error deleting customer" });
    }
};
