import mongoose from 'mongoose';
import Location from '../models/Location.js';
import fs from 'fs';
import csv from 'csv-parser';

// Connect to your MongoDB
mongoose.connect('mongodb+srv://rohit:Rohit254920@cluster0.fcwrazo.mongodb.net/itel?retryWrites=true&w=majority&appName=Cluster0', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

// For JSON data
async function importFromJSON() {
    try {
        const data = JSON.parse(fs.readFileSync('pincodes.json'));
        await Location.insertMany(data);
        console.log(`${data.length} pincodes imported successfully`);
    } catch (err) {
        console.error('Error importing pincodes:', err);
    } finally {
        mongoose.disconnect();
    }
}

// For CSV data
async function importFromCSV() {
    const results = [];

    fs.createReadStream('pincodes.csv')
        .pipe(csv())
        .on('data', (data) => results.push(data))
        .on('end', async () => {
            try {
                await Location.insertMany(results);
                console.log(`${results.length} pincodes imported successfully`);
            } catch (err) {
                console.error('Error importing pincodes:', err);
            } finally {
                mongoose.disconnect();
            }
        });
}

// Choose one method based on your file format
// importFromJSON();
importFromCSV();