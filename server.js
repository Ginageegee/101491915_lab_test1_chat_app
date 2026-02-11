require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const User = require("./models/User");
const GroupMessage = require("./models/GroupMessage");
const PrivateMessage = require("./models/PrivateMessage");

const app = express();
const server = http.createServer(app);

app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));
app.use("/views", express.static(path.join(__dirname, "views")));

app.get("/", (req, res) => res.redirect("/views/login.html"));

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB error:", err));

const ROOMS = ["devops", "cloud computing", "covid19", "sports", "nodeJS"];

function formatDate() {
    return new Date().toLocaleString();
}

// Signup
app.post("/api/signup", async (req, res) => {
    try {
        const { username, firstname, lastname, password } = req.body;
        if (!username || !firstname || !lastname || !password) {
            return res.status(400).json({ message: "All fields are required." });
        }

        const exists = await User.findOne({ username });
        if (exists) return res.status(409).json({ message: "Username already exists." });

        const hashed = await bcrypt.hash(password, 10);

        await User.create({
            username,
            firstname,
            lastname,
            password: hashed,
            createon: formatDate()
        });

        res.json({ message: "Signup successful" });
    } catch (e) {
        res.status(500).json({ message: "Server error" });
    }
});

// Login
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) return res.status(400).json({ message: "Username and password required." });

        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: "Invalid credentials." });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: "Invalid credentials." });

        res.json({
            message: "Login successful",
            user: { username: user.username, firstname: user.firstname, lastname: user.lastname },
            rooms: ROOMS
        });
    } catch (e) {
        res.status(500).json({ message: "Server error" });
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));
