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

        const address = user.addresses.id(id);
        if (!address) return res.status(404).json({ message: 'Address not found' });

        Object.assign(address, req.body); // update fields
        await user.save();
        res.json(user.addresses);
    } catch (error) {
        res.status(500).json({ message: 'Failed to update address' });
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
