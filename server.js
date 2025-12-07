// server.js (Universal: Local + Vercel)

require("dotenv").config();
const express = require("express");
const { MongoClient } = require("mongodb");
const webpush = require("web-push");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

const MONGO_URI = process.env.MONGO_URI;
const SUBSCRIPTIONS_COLLECTION = "subscriptions";

// ---- MongoDB Connection (Reusable for serverless) ----
let client;
let db;

async function connectDB() {
  if (!client) {
    client = new MongoClient(MONGO_URI);
    await client.connect();
    db = client.db("push-db");
    console.log("Mongo connected");
  }
  return db;
}

// ---- VAPID Keys ----
webpush.setVapidDetails(
  process.env.VAPID_SUBJECT,
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
);

// ---- ROUTES ----

// Subscribe
app.post("/api/v1/subscribe", async (req, res) => {
  try {
    await connectDB();
    const subscription = req.body;

    if (!subscription?.endpoint) {
      return res.status(400).json({ error: "Invalid subscription" });
    }

    const existing = await db
      .collection(SUBSCRIPTIONS_COLLECTION)
      .findOne({ endpoint: subscription.endpoint });

    if (!existing) {
      await db.collection(SUBSCRIPTIONS_COLLECTION).insertOne(subscription);
      console.log("New subscription saved");
    }

    res.status(201).json({ message: "Subscription saved" });
  } catch (error) {
    console.error("Subscribe error:", error);
    res.status(500).json({ error: "Subscribe failed" });
  }
});

// Send notification
app.post("/api/v1/send-notification", async (req, res) => {
  try {
    await connectDB();

    const payload = JSON.stringify({
      title: "Demo Notification!",
      body: "Testing your custom backend setup!",
    });

    const subscriptions = await db
      .collection(SUBSCRIPTIONS_COLLECTION)
      .find({})
      .toArray();

    const results = subscriptions.map((sub) =>
      webpush.sendNotification(sub, payload).catch(async (err) => {
        if (err.statusCode === 410 || err.statusCode === 404) {
          console.log("Deleting expired subscription");
          await db
            .collection(SUBSCRIPTIONS_COLLECTION)
            .deleteOne({ endpoint: sub.endpoint });
        } else {
          console.error("Push error:", err);
        }
      })
    );

    await Promise.allSettled(results);
    res.status(200).json({ message: "Notifications processed" });
  } catch (error) {
    console.error("Send error:", error);
    res.status(500).json({ error: "Notification send failed" });
  }
});

// ---- Local Run ----
if (process.env.LOCAL === "true") {
  const PORT = process.env.PORT || 3000;
  connectDB().then(() => {
    app.listen(PORT, () =>
      console.log(`Local API running on http://localhost:${PORT}`)
    );
  });
}

// ---- Export for Vercel ----
module.exports = app;
