const express = require("express");
const cors = require("cors");
const fs = require("fs");
const bcrypt = require("bcryptjs");

const app = express();
app.use(cors());
app.use(express.json());

const dbFile = "users.json";

function loadUsers() {
    if (!fs.existsSync(dbFile)) return [];
    return JSON.parse(fs.readFileSync(dbFile));
}

function saveUsers(data) {
    fs.writeFileSync(dbFile, JSON.stringify(data, null, 2));
}

app.get("/", (req, res) => {
    res.send("Auth backend working!");
});

app.post("/signup", async (req, res) => {
    const { name, phone, password, user_id } = req.body;
    if (!name || !phone || !password)
        return res.status(400).json({ error: "Maʼlumot yetarli emas!" });

    let users = loadUsers();
    if (users.find(u => u.phone === phone))
        return res.status(400).json({ error: "Bu raqam oldin roʼyxatdan oʼtgan!" });

    const hashed = await bcrypt.hash(password, 10);
    users.push({ name, phone, password: hashed, user_id });
    saveUsers(users);

    res.json({ success: true, message: "Roʼyxatdan oʼtish muvaffaqiyatli!" });
});

app.post("/login", async (req, res) => {
    const { phone, password } = req.body;
    let users = loadUsers();
    let user = users.find(u => u.phone === phone);

    if (!user) return res.status(400).json({ error: "Bunday foydalanuvchi yoʼq!" });

    const correct = await bcrypt.compare(password, user.password);
    if (!correct)
        return res.status(400).json({ error: "Parol notoʼgʼri!" });

    res.json({ success: true, user });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server is running:", PORT));
