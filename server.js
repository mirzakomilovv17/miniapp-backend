const express = require("express");
const cors = require("cors");

const app = express();

// CORS TO‘G‘RI YOQILDI
app.use(cors({
    origin: "*",       // barcha domenlarga ruxsat
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

app.use(express.json());

// TEST ROUTE
app.get("/", (req, res) => {
    res.send("Backend is running OK!");
});

// DATA QABUL QILISH
app.post("/save", (req, res) => {
    console.log("Kelgan ma'lumot:", req.body);

    if (!req.body.name || !req.body.phone || !req.body.user_id) {
        return res.status(400).json({ success: false, msg: "Xato ma'lumot!" });
    }

    res.json({ success: true, msg: "Ma'lumot saqlandi!" });
});

// PORT
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port " + PORT));
