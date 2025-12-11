// backend/server.js
const express = require("express");
const cors = require("cors");
const path = require("path");
const axios = require("axios");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "database.db");
const BOT_TOKEN = process.env.BOT_TOKEN; // <- Render: set this
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

let db;
async function initDB() {
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });
  await db.exec(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT,
    name TEXT UNIQUE,
    password TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);
  await db.exec(`CREATE TABLE IF NOT EXISTS codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    telegram_id TEXT,
    code TEXT,
    expires_at INTEGER
  )`);
}
initDB().catch(console.error);

// helpers
function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}
async function sendTelegramMessage(chat_id, text) {
  if (!TELEGRAM_API) throw new Error("BOT_TOKEN not configured");
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id,
    text,
    parse_mode: "HTML"
  });
}

// routes
app.get("/", (req, res) => res.send("Auth backend running!"));

// send code -> body: { user_id }
app.post("/send-code", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id required" });

    const code = genCode();
    const expires_at = Date.now() + 5 * 60 * 1000; // 5 minutes

    await db.run("DELETE FROM codes WHERE telegram_id = ?", [String(user_id)]);
    await db.run("INSERT INTO codes (telegram_id, code, expires_at) VALUES (?, ?, ?)", [String(user_id), code, expires_at]);

    const text = `Sizning tasdiqlash kodingiz: <b>${code}</b>\nBu kod 5 daqiqa ichida amal qiladi.`;
    await sendTelegramMessage(user_id, text);

    res.json({ success: true, message: "Kod yuborildi" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Kod yuborilmadi" });
  }
});

// verify-code -> body: { user_id, code }
app.post("/verify-code", async (req, res) => {
  try {
    const { user_id, code } = req.body;
    if (!user_id || !code) return res.status(400).json({ error: "user_id and code required" });

    const row = await db.get("SELECT * FROM codes WHERE telegram_id = ? AND code = ?", [String(user_id), String(code)]);
    if (!row) return res.status(400).json({ error: "Kod noto'g'ri yoki mavjud emas" });
    if (Date.now() > row.expires_at) {
      await db.run("DELETE FROM codes WHERE id = ?", [row.id]);
      return res.status(400).json({ error: "Kod muddati o'tgan" });
    }

    await db.run("DELETE FROM codes WHERE id = ?", [row.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// check-name -> body: { name }
app.post("/check-name", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });
    const user = await db.get("SELECT * FROM users WHERE name = ?", [name]);
    return res.json({ ok: !user });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// set-profile -> body: { user_id, name, password }
app.post("/set-profile", async (req, res) => {
  try {
    const { user_id, name, password } = req.body;
    if (!user_id || !name || !password) return res.status(400).json({ error: "user_id, name and password required" });
    if (password.length < 8) return res.status(400).json({ error: "Parol kamida 8 belgidan iborat bo'lishi kerak" });

    const existing = await db.get("SELECT * FROM users WHERE name = ?", [name]);
    if (existing && existing.telegram_id !== String(user_id)) return res.status(400).json({ error: "Bu ism band" });

    const hashed = await bcrypt.hash(password, 10);
    const byTg = await db.get("SELECT * FROM users WHERE telegram_id = ?", [String(user_id)]);
    if (byTg) {
      await db.run("UPDATE users SET name = ?, password = ? WHERE telegram_id = ?", [name, hashed, String(user_id)]);
      const user = await db.get("SELECT id, telegram_id, name, created_at FROM users WHERE telegram_id = ?", [String(user_id)]);
      return res.json({ success: true, user });
    } else {
      await db.run("INSERT INTO users (telegram_id, name, password) VALUES (?, ?, ?)", [String(user_id), name, hashed]);
      const user = await db.get("SELECT id, telegram_id, name, created_at FROM users WHERE telegram_id = ?", [String(user_id)]);
      return res.json({ success: true, user });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

// login -> body: { name, password }
app.post("/login", async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: "name and password required" });
    const user = await db.get("SELECT * FROM users WHERE name = ?", [name]);
    if (!user) return res.status(400).json({ error: "Foydalanuvchi topilmadi" });
    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Parol xato" });
    const safe = { id: user.id, telegram_id: user.telegram_id, name: user.name, created_at: user.created_at };
    return res.json({ success: true, user: safe });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Server error" });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
