// backend/server.js
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");
const axios = require("axios");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");

const app = express();
app.use(cors());
app.use(express.json());

const DB_PATH = path.join(__dirname, "database.db");
const BOT_TOKEN = process.env.BOT_TOKEN; // set this in Render environment variables
const TELEGRAM_API = BOT_TOKEN ? `https://api.telegram.org/bot${BOT_TOKEN}` : null;

let db;
async function initDB() {
  db = await open({ filename: DB_PATH, driver: sqlite3.Database });

  await db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT,
      name TEXT UNIQUE,
      password TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  await db.exec(`
    CREATE TABLE IF NOT EXISTS codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      telegram_id TEXT,
      code TEXT,
      expires_at INTEGER
    );
  `);
}
initDB().catch(console.error);

// helper: generate 6-digit code
function genCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// send Telegram message (returns axios response)
async function sendTelegramCode(chat_id, text) {
  if (!TELEGRAM_API) throw new Error("BOT_TOKEN not configured in env");
  return axios.post(`${TELEGRAM_API}/sendMessage`, {
    chat_id,
    text,
    parse_mode: "HTML"
  });
}

// root
app.get("/", (req, res) => res.send("Auth backend running!"));


/* ========== /send-code ==========
body: { user_id }
Sends 6-digit code to provided Telegram user_id.
*/
app.post("/send-code", async (req, res) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: "user_id required" });

    const code = genCode();
    const expires_at = Date.now() + 5 * 60 * 1000; // 5 minutes

    // save code (allow only one active per user: delete old)
    await db.run("DELETE FROM codes WHERE telegram_id = ?", [user_id]);
    await db.run("INSERT INTO codes (telegram_id, code, expires_at) VALUES (?, ?, ?)", [user_id, code, expires_at]);

    // send via Telegram
    const text = `Sizning tasdiqlash kodingiz: <b>${code}</b>\nBu kod 5 daqiqa ichida amal qiladi.`;
    await sendTelegramCode(user_id, text);

    return res.json({ success: true, message: "Kod yuborildi" });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Kod yuborilmadi" });
  }
});


/* ========== /verify-code ==========
body: { user_id, code }
Checks if code matches and not expired.
*/
app.post("/verify-code", async (req, res) => {
  try {
    const { user_id, code } = req.body;
    if (!user_id || !code) return res.status(400).json({ error: "user_id va code kerak" });

    const row = await db.get("SELECT * FROM codes WHERE telegram_id = ? AND code = ?", [user_id, code]);
    if (!row) return res.status(400).json({ error: "Kod noto'g'ri yoki yo'q" });

    if (Date.now() > row.expires_at) {
      await db.run("DELETE FROM codes WHERE id = ?", [row.id]);
      return res.status(400).json({ error: "Kod muddati o'tgan" });
    }

    // ok — delete code (one-time)
    await db.run("DELETE FROM codes WHERE id = ?", [row.id]);
    return res.json({ success: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server xatosi" });
  }
});


/* ========== /check-name ==========
body: { name }
Returns { ok: true } if name free, else { ok: false }
*/
app.post("/check-name", async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ error: "name required" });

    const user = await db.get("SELECT * FROM users WHERE name = ?", [name]);
    if (user) return res.json({ ok: false });
    return res.json({ ok: true });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server xatosi" });
  }
});


/* ========== /set-profile ==========
body: { user_id, name, password }
Creates user record; name must be unique; password hashed.
If user's telegram_id already exists, update name/password.
*/
app.post("/set-profile", async (req, res) => {
  try {
    const { user_id, name, password } = req.body;
    if (!user_id || !name || !password) return res.status(400).json({ error: "user_id, name va password kerak" });

    // password validation
    if (password.length < 8) return res.status(400).json({ error: "Parol kamida 8 belgidan iborat bo‘lishi kerak" });

    // check name uniqueness
    const existing = await db.get("SELECT * FROM users WHERE name = ?", [name]);
    if (existing && existing.telegram_id !== String(user_id)) {
      return res.status(400).json({ error: "Bu ism band" });
    }

    const hashed = await bcrypt.hash(password, 10);

    // if user with this telegram_id exists -> update, else insert
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
    return res.status(500).json({ error: "Server xatosi" });
  }
});


/* ========== /login ==========
body: { name, password }
*/
app.post("/login", async (req, res) => {
  try {
    const { name, password } = req.body;
    if (!name || !password) return res.status(400).json({ error: "name va password kerak" });

    const user = await db.get("SELECT * FROM users WHERE name = ?", [name]);
    if (!user) return res.status(400).json({ error: "Foydalanuvchi topilmadi" });

    const ok = await bcrypt.compare(password, user.password);
    if (!ok) return res.status(400).json({ error: "Parol xato" });

    // return safe user (no password)
    const safe = { id: user.id, telegram_id: user.telegram_id, name: user.name, created_at: user.created_at };
    return res.json({ success: true, user: safe });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: "Server xatosi" });
  }
});


const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
