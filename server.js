import express from "express";
import cors from "cors";
import sqlite3 from "sqlite3";
import { open } from "sqlite";

const app = express();
app.use(cors());
app.use(express.json());

// --- DATABASE ---
let db;

async function initDB() {
  db = await open({
    filename: "./database.db",
    driver: sqlite3.Database,
  });

  await db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id INTEGER PRIMARY KEY,
          tg_id TEXT UNIQUE,
          name TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);
}

initDB();

// --- ROUTES ---
// Test
app.get("/", (req, res) => {
  res.send("Backend ishlayapti! 🔥");
});

// User saqlash
app.post("/save-user", async (req, res) => {
  const { tg_id, name } = req.body;

  if (!tg_id)
    return res.status(400).json({ error: "tg_id kerak!" });

  try {
    await db.run(
      "INSERT OR IGNORE INTO users (tg_id, name) VALUES (?, ?)",
      [tg_id, name || ""]
    );

    res.json({ success: true, message: "User saqlandi" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Barcha userlar
app.get("/users", async (req, res) => {
  const users = await db.all("SELECT * FROM users");
  res.json(users);
});

// Serverni ishga tushirish
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
