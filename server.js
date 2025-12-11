const express = require("express");
const cors = require("cors");
const app = express();

app.use(cors());
app.use(express.json());

// ROOT URL -> test uchun
app.get("/", (req, res) => {
    res.send("Backend is running!");
});

// SAVE API
app.post("/save", (req, res) => {
    console.log("Data received:", req.body);
    res.json({ success: true });
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log("Server running on port", PORT));
