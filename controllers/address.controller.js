import User from "../models/User.js";


export const getAddresses = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        console.log('user: ', user)
        res.json(user.addresses || []);
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch addresses' });
    }
};


export const addAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        if (user.role !== 'customer' && user.role !== 'guest') {
            return res.status(403).json({ message: 'Only customers can add addresses' });
        }

        const newAddress = req.body;

        // If it's marked as default, reset others
        if (newAddress.isDefault) {
            user.addresses.forEach(addr => (addr.isDefault = false));
        }

        user.addresses.push(newAddress);
        await user.save();
        res.status(201).json(user.addresses);
    } catch (error) {
        res.status(500).json({ message: 'Failed to add address', error: error.message });
    }
};


export const updateAddress = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    // Try finding the address subdocument
    let address = user.addresses.id(id);

    // Fallback if .id() doesn't work
    if (!address) {
      address = user.addresses.find((addr) => addr._id.toString() === id);
    }

    if (!address) {
      return res.status(404).json({ message: "Address not found" });
    }

    // Update only provided fields
    Object.assign(address, req.body);

    await user.save();

    return res.json({
      message: "Address updated successfully",
      addresses: user.addresses,
    });
  } catch (error) {
    console.error("Update address error:", error); // 🔍 log exact error
    return res.status(500).json({
      message: "Failed to update address",
      error: error.message,
    });
  }
};



export const deleteAddress = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    user.addresses = user.addresses.filter(addr => addr._id.toString() !== req.params.id);
    await user.save();
    res.json(user.addresses);
  } catch (error) {
    res.status(500).json({ message: 'Failed to delete address' });
  }
};



export const setDefaultAddress = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        user.addresses.forEach(addr => {
            addr.isDefault = addr._id.toString() === req.params.id;
        });

        await user.save();
        res.json(user.addresses);
    } catch (error) {
        res.status(500).json({ message: 'Failed to set default address' });
    }
};
