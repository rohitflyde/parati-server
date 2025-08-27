// controllers/pincodeController.js
import Location from "../models/Location.js";

export const lookupPincode = async (req, res) => {
    const { pin } = req.query;
    console.log(pin)
    if (!pin) return res.status(400).json({ success: false, message: "Pincode required" });

    try {
        const record = await Location.findOne({ pin: Number(pin) });
        console.log(record)
        if (!record) {
            return res.json({ serviceable: false });
        }

        return res.json({
            serviceable: record.isServiceable,
            city: record.city,
            state: record.state,
        });
    } catch (err) {
        return res.status(500).json({ success: false, message: "Server error" });
    }
};
