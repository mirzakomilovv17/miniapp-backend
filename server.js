import express from "express";
import cors from "cors";

const app = express();

// MUHIM – Frontenddan POST so‘rovini qabul qilish uchun
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
    res.send("Backend running on Render!");
});

app.post("/save", (req, res) => {
    console.log("Keldi:", req.body);

    return res.json({ status: "ok", received: req.body });
});

// Render porti
const port = process.env.PORT || 10000;
app.listen(port, () => {
    console.log("Server running on port", port);
});
