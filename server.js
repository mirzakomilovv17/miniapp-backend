const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const bcrypt = require("bcryptjs");
const fetch = require("node-fetch");

const app = express();
app.use(cors());
app.use(bodyParser.json());

// Fake database
let users = [];
let codes = {}; // { phone: code }

// Telegram bot token
const BOT_TOKEN = "YOUR_TELEGRAM_BOT_TOKEN";

// Telegramga kod yuborish
app.post("/send-code", async (req, res) => {
    try {
        const { chat_id } = req.body;

        if (!chat_id) {
            return res.json({ success: false, msg: "Telegram ID topilmadi" });
        }

        // random 6 xonali kod
        const code = Math.floor(100000 + Math.random() * 900000);
        codes[chat_id] = code;

        await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/sendMessage`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                chat_id: chat_id,
                text: `Tasdiqlash kodi: ${code}`
            })
        });

        res.json({ success: true });
    } catch (e) {
        res.json({ success: false, msg: "Kod yuborilmadi" });
    }
});

// Kodni tekshirish
app.post("/verify-code", (req, res) => {
    const { chat_id, code } = req.body;

    if (codes[chat_id] == code) {
        return res.json({ success: true });
    } else {
        return res.json({ success: false, msg: "Xato kod" });
    }
});

// Ism band yoki yo'qligini tekshirish
app.post("/check-name", (req, res) => {
    const { name } = req.body;

    const exists = users.find(u => u.name === name);
    if (exists) {
        return res.json({ available: false });
    } else {
        return res.json({ available: true });
    }
});

// Ro‘yxatdan o‘tish
app.post("/signup", (req, res) => {
    const { name, password, chat_id } = req.body;

    const exist = users.find(u => u.name === name);
    if (exist) return res.json({ success: false, msg: "Bu ism band" });

    const hashed = bcrypt.hashSync(password, 10);

    users.push({ name, password: hashed, chat_id });

    res.json({ success: true });
});

// Login
app.post("/login", (req, res) => {
    const { name, password } = req.body;

    const user = users.find(u => u.name === name);
    if (!user) return res.json({ success: false, msg: "Xato ma'lumot" });

    const ok = bcrypt.compareSync(password, user.password);
    if (!ok) return res.json({ success: false, msg: "Xato ma'lumot" });

    res.json({ success: true, user });
});


app.listen(3000, () => console.log("Server running on port 3000"));
