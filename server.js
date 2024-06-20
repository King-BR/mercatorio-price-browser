require('dotenv').config(); // Load environment variables from .env file

const express = require('express');
const axios = require('axios');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const CACHE_DIR = path.join(__dirname, 'cache');
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes in milliseconds

// Ensure the cache directory exists
fs.mkdir(CACHE_DIR, { recursive: true }).catch(console.error);

// Read environment variables
const mercUser = process.env.MERC_USER;
const authToken = process.env.AUTH_TOKEN;

if (!mercUser || !authToken) {
    console.error("MERC_USER and AUTH_TOKEN must be set in the .env file.");
    process.exit(1); // Exit if the credentials are not set
}

// Function to fetch and cache market data for a town
async function fetchAndCacheTownData(townId) {
    const cacheFilePath = path.join(CACHE_DIR, `${townId}.json`);
    const apiUrl = `https://play.mercatorio.io/api/towns/${townId}/marketdata`;

    try {
        const response = await axios.get(apiUrl, {
            headers: {
                'X-Merc-user': mercUser,
                'Authorization': authToken
            }
        });

        const marketData = response.data;

        // Write the data to a cache file
        await fs.writeFile(cacheFilePath, JSON.stringify(marketData, null, 2));
        console.log(`Data for town ID ${townId} cached successfully.`);
    } catch (error) {
        console.error(`Error caching data for town ID ${townId}:`, error.message);
    }
}

// Endpoint to trigger cache update for all towns
app.get('/update-cache', async (req, res) => {
    try {
        // Fetch the list of towns
        const townsResponse = await axios.get('https://play.mercatorio.io/api/towns', {
            headers: {
                'X-Merc-user': mercUser,
                'Authorization': authToken
            }
        });
        const towns = townsResponse.data;

        // Fetch and cache data for each town
        const fetchPromises = towns.map(town => fetchAndCacheTownData(town.id));
        await Promise.all(fetchPromises);

        res.send("Cache updated successfully.");
    } catch (error) {
        console.error("Error updating cache:", error.message);
        res.status(500).send("Error updating cache.");
    }
});

// Serve cached data
app.get('/data/:townId', async (req, res) => {
    const townId = req.params.townId;
    const cacheFilePath = path.join(CACHE_DIR, `${townId}.json`);

    try {
        // Check if the file exists and is within the cache duration
        const stats = await fs.stat(cacheFilePath);
        const now = new Date();
        if ((now - new Date(stats.mtime)) < CACHE_DURATION) {
            const data = await fs.readFile(cacheFilePath, 'utf-8');
            return res.json(JSON.parse(data));
        }
    } catch (error) {
        // If the file doesn't exist or is expired, fetch and cache new data
        console.error(`Cache file error for town ID ${townId}:`, error.message);
    }

    // If cache is outdated or missing, update it and serve the data
    try {
        await fetchAndCacheTownData(townId);
        const data = await fs.readFile(cacheFilePath, 'utf-8');
        res.json(JSON.parse(data));
    } catch (error) {
        console.error(`Error fetching data for town ID ${townId}:`, error.message);
        res.status(500).send("Error fetching data.");
    }
});

// Serve the frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
