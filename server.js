// server.js

require("dotenv").config(); // Load environment variables from .env
const express = require("express");
const { MongoClient } = require("mongodb"); // Using standard MongoDB driver
const webpush = require("web-push");
const cors = require("cors"); // Required for your frontend to talk to this backend

const app = express();
const PORT = process.env.PORT || 3000;
const MONGO_URI = process.env.MONGO_URI;
const SUBSCRIPTIONS_COLLECTION = "subscriptions"; // Collection name in MongoDB

// Middleware setup
app.use(express.json());
app.use(cors());

// --- MongoDB Setup ---
let db;
const connectDB = async () => {
  try {
    const client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db("push-db"); // Use the database name specified in your URI or choose one
    console.log("Database connected successfully to Atlas.");
  } catch (err) {
    console.error("Database connection failed:", err);
    process.exit(1); // Exit if connection fails
  }
};

// --- VAPID Setup ---
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// --- API Endpoints ---

/**
 * POST /subscribe
 * Receives the push subscription object from the client and saves it to the database.
 */
app.post("/api/v1/subscribe", async (req, res) => {
  const subscription = req.body;

  if (!subscription || !subscription.endpoint) {
    return res.status(400).json({ error: "Invalid subscription object." });
  }

  try {
    // Check if the subscription already exists
    const existing = await db
      .collection(SUBSCRIPTIONS_COLLECTION)
      .findOne({ endpoint: subscription.endpoint });

    if (!existing) {
      await db.collection(SUBSCRIPTIONS_COLLECTION).insertOne(subscription);
      console.log("New subscription saved.");
      //
    } else {
      console.log("Subscription already exists, not saved.");
    }

    res.status(201).json({ message: "Subscription handled." });
  } catch (error) {
    console.error("Error saving subscription:", error);
    res.status(500).json({ error: "Could not save subscription." });
  }
});

/**
 * POST /send-notification
 * Retrieves all subscriptions and sends a push message to each one.
 * NOTE: For a real app, this would be an internal/authenticated endpoint or background job.
 */
app.post("/api/v1/send-notification", async (req, res) => {
  // Customize your notification payload
  const payload = JSON.stringify({
    title: "Demo Notification!",
    body: "Testing your custom backend setup!",
    icon: "/images/icon.png", // Optional: requires client-side asset
  });

  try {
    // Fetch all subscriptions from the database
    const subscriptions = await db
      .collection(SUBSCRIPTIONS_COLLECTION)
      .find({})
      .toArray();
    console.log(
      `Attempting to send notification to ${subscriptions.length} subscribers.`
    );

    const pushPromises = subscriptions.map((sub) => {
      return webpush.sendNotification(sub, payload).catch(async (error) => {
        // **CRUCIAL ERROR HANDLING**
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(
            `Subscription ${sub.endpoint} is expired or invalid (Code: ${error.statusCode}). Deleting from DB.`
          );
          // Delete the invalid subscription from the database
          await db
            .collection(SUBSCRIPTIONS_COLLECTION)
            .deleteOne({ endpoint: sub.endpoint });
        } else {
          console.error("Error sending push notification:", error);
        }
      });
    });

    // Wait for all push promises to settle (resolve or reject)
    await Promise.allSettled(pushPromises);

    res.status(200).json({ message: "Push notifications queued/sent." });
  } catch (error) {
    console.error("Error fetching subscriptions or sending pushes:", error);
    res.status(500).json({ error: "Failed to send notifications." });
  }
});

// Start the server only after connecting to the database
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`API URL: http://localhost:${PORT}`);
  });
});
