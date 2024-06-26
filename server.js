const express = require("express");
const fetch = require("node-fetch");
const fs = require("fs").promises;
const path = require("path");
require("dotenv").config(); // Load environment variables from .env file

const app = express();
const PORT = 3000;
const CACHE_DIR = path.join(__dirname, "cache");
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

// Helper function to delay execution
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Function to fetch and cache market data for a town
async function fetchAndCacheTownData(townId) {
  const cacheFilePath = path.join(CACHE_DIR, `${townId}.json`);
  const apiUrl = `https://play.mercatorio.io/api/towns/${townId}/marketdata`;

  try {
    const response = await fetch(apiUrl, {
      headers: {
        "X-Merc-user": mercUser,
        Authorization: authToken,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const marketData = await response.json();

    // Convert relevant properties to float
    for (const itemName in marketData.markets) {
      const itemData = marketData.markets[itemName];
      convertStringToFloat(itemData, [
        "price",
        "open_price",
        "last_price",
        "average_price",
        "moving_average",
        "highest_bid",
        "low_price",
        "high_price",
        "volume",
        "volume_prev_12",
        "bid_volume_10",
        "lowest_ask",
      ]);
    }

    // Write the data to a cache file
    await fs.writeFile(cacheFilePath, JSON.stringify(marketData, null, 2));
    console.log(`Data for town ID ${townId} cached successfully.`);

    return marketData;
  } catch (error) {
    console.error(`Error caching data for town ID ${townId}:`, error.message);
    throw error; // Re-throw the error to handle it elsewhere if needed
  }
}

// Helper function to convert relevant properties from string to float
function convertStringToFloat(obj, properties) {
  properties.forEach((prop) => {
    if (typeof obj[prop] === "string") {
      obj[prop] = parseFloat(obj[prop]);
    }
  });
}

// Endpoint to trigger cache update for all towns
app.get("/update-cache", async (req, res) => {
  try {
    // Fetch the list of towns
    const townsResponse = await fetch("https://play.mercatorio.io/api/towns", {
      headers: {
        "X-Merc-user": mercUser,
        Authorization: authToken,
      },
    });

    if (!townsResponse.ok) {
      throw new Error(`HTTP error! Status: ${townsResponse.status}`);
    }

    const towns = await townsResponse.json();

    // Function to fetch and cache data for a town with optional delay
    const fetchAndCacheWithDelay = async (townId, shouldDelay = true) => {
      await fetchAndCacheTownData(townId);
      if (shouldDelay) {
        console.log(
          `Waiting for 1 second before fetching data for next town...`
        );
        await delay(1000); // Wait for 1 second if shouldDelay is true
      }
    };

    // Fetch and cache data for each town with a 1-second delay between requests
    for (let i = 0; i < towns.length; i++) {
      const town = towns[i];
      await fetchAndCacheWithDelay(town.id, i < towns.length - 1); // Delay only for requests except the last one
    }

    res.json(towns); // Return the list of towns for the client to use
  } catch (error) {
    console.error("Error updating cache:", error.message);
    res.status(500).send("Error updating cache.");
  }
});

// Serve cached data
app.get("/data/:townId", async (req, res) => {
  const townId = req.params.townId;
  const cacheFilePath = path.join(CACHE_DIR, `${townId}.json`);

  try {
    // Check if the file exists and is within the cache duration
    const stats = await fs.stat(cacheFilePath);
    const now = new Date();
    if (now - new Date(stats.mtime) < CACHE_DURATION) {
      const data = await fs.readFile(cacheFilePath, "utf-8");
      const parsedData = JSON.parse(data);

      // Convert relevant properties to float if they are not already
      for (const itemName in parsedData.markets) {
        const itemData = parsedData.markets[itemName];
        convertStringToFloat(itemData, [
          "price",
          "open_price",
          "last_price",
          "average_price",
          "moving_average",
          "highest_bid",
          "lowest_ask",
          "low_price",
          "high_price",
          "volume",
          "volume_prev_12",
          "bid_volume_10",
        ]);
      }

      return res.json(parsedData);
    }
  } catch (error) {
    // If there's an error in reading the file or parsing JSON, log it
    console.error(`Cache file error for town ID ${townId}:`, error.message);
  }

  // If cache is outdated or missing, update it and serve the data
  try {
    const freshData = await fetchAndCacheTownData(townId);
    res.json(freshData);
  } catch (error) {
    console.error(`Error fetching data for town ID ${townId}:`, error.message);
    res.status(500).send("Error fetching data.");
  }
});

// Serve the frontend files
app.use(express.static(path.join(__dirname, "public")));

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
