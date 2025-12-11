const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ====== API ======
app.post("/save", (req, res) => {
    console.log("Kelgan ma'lumot:", req.body);

    const { user_id, name, phone } = req.body;

    if (!user_id || !name || !phone) {
        return res.status(400).json({ error: "Missing data" });
    }

    // Hozircha faqat qaytarib yuboramiz
    return res.json({
        success: true,
        message: "Data received!",
        data: req.body
    });
});

// ====== SERVER ======
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
