import mongoose from "mongoose";
import fs from "fs";
import Navigation from "../models/Navigation.js"; // ✅ aapka schema

async function seedNavigation() {
  try {
    await mongoose.connect("mongodb+srv://rohit:Rohit254920@cluster0.fcwrazo.mongodb.net/parati?retryWrites=true&w=majority&appName=Cluster0");

    const raw = JSON.parse(fs.readFileSync("./navigation-backup.json", "utf-8"));

    // ✅ MongoDB ke extra fields clean karo
    const cleanData = JSON.parse(
      JSON.stringify(raw, (key, value) => {
        if (["_id", "__v", "createdAt", "updatedAt"].includes(key)) return undefined;
        if (value && value.$oid) return value.$oid;
        if (value && value.$date) return new Date(value.$date);
        return value;
      })
    );

    // Purana data clear
    await Navigation.deleteMany({});

    // Insert naya data
    await Navigation.create(cleanData);

    console.log("✅ Navigation data imported successfully!");
    process.exit(0);
  } catch (err) {
    console.error("❌ Error seeding navigation:", err);
    process.exit(1);
  }
}

seedNavigation();
