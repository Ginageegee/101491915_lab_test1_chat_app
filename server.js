
require("dotenv").config();

const path = require("path");
const express = require("express");
const http = require("http");
const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
const cors = require("cors");

const User = require("./models/User");
const GroupMessage = require("./models/GroupMessage");
const PrivateMessage = require("./models/PrivateMessage");

const app = express();
const server = http.createServer(app);
const { Server } = require("socket.io");
const io = new Server(server);

app.use(cors());
app.use(express.json());

// Static files
app.use(express.static(path.join(__dirname, "public")));
app.use("/views", express.static(path.join(__dirname, "views")));

// Default route
app.get("/", (req, res) => res.redirect("/views/login.html"));

// MongoDB
mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB connected"))
    .catch((err) => console.error("MongoDB connection error:", err));

const ROOMS = ["devops", "cloud computing", "covid19", "sports", "nodeJS"];

function formatDate() {
    return new Date().toLocaleString();
}

//Authentication routes
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

        return res.json({ message: "Signup successful" });
    } catch (err) {
        return res.status(500).json({ message: "Server error", error: String(err) });
    }
});

// Login
app.post("/api/login", async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) {
            return res.status(400).json({ message: "Username and password required." });
        }

        const user = await User.findOne({ username });
        if (!user) return res.status(401).json({ message: "Invalid password or username." });

        const ok = await bcrypt.compare(password, user.password);
        if (!ok) return res.status(401).json({ message: "Invalid password or username." });

        return res.json({
            message: "Login successful",
            user: { username: user.username, firstname: user.firstname, lastname: user.lastname },
            rooms: ROOMS
        });
    } catch (err) {
        return res.status(500).json({ message: "Server error", error: String(err) });
    }
});

// room list
app.get("/api/rooms", (req, res) => res.json({ rooms: ROOMS }));

//Message history
// Group history by room
app.get("/api/messages/group/:room", async (req, res) => {
    try {
        const room = req.params.room;
        const messages = await GroupMessage.find({ room }).sort({ _id: 1 }).limit(200);
        return res.json({ messages });
    } catch (err) {
        return res.status(500).json({ message: "Server error", error: String(err) });
    }
});

// Private history between user 1 and 2
app.get("/api/messages/private", async (req, res) => {
    try {
        const { u1, u2 } = req.query;
        if (!u1 || !u2) return res.status(400).json({ message: "user 1 and user 2 required" });

        const messages = await PrivateMessage.find({
            $or: [
                { from_user: u1, to_user: u2 },
                { from_user: u2, to_user: u1 }
            ]
        })
            .sort({ _id: 1 })
            .limit(200);

        return res.json({ messages });
    } catch (err) {
        return res.status(500).json({ message: "Server error", error: String(err) });
    }
});


//SOCKET.IO
const userToSocket = new Map(); // username -> socket.id

io.on("connection", (socket) => {
    // Register current user (called after login on chat page)
    socket.on("register_user", (username) => {
        if (username) userToSocket.set(username, socket.id);
    });

    // Join one room at a time
    socket.on("join_room", (room) => {
        if (!ROOMS.includes(room)) return;

        // leave any previously joined rooms (except the socket's own room)
        for (const r of socket.rooms) {
            if (r !== socket.id) socket.leave(r);
        }

        socket.join(room);
        socket.emit("joined_room", room);
    });

    // Leave current room
    socket.on("leave_room", (room) => {
        socket.leave(room);
        socket.emit("left_room", room);
    });

    // Typing indicator
    socket.on("typing", ({ room, username, isTyping }) => {
        if (!room) return;
        socket.to(room).emit("typing", { username, isTyping });
    });

    // Group message
    socket.on("group_message", async ({ room, from_user, message }) => {
        try {
            if (!room || !from_user || !message) return;
            if (!ROOMS.includes(room)) return;

            const saved = await GroupMessage.create({
                from_user,
                room,
                message,
                date_sent: formatDate()
            });

            io.to(room).emit("group_message", saved);
        } catch (err) {
            // optional: emit error back to sender
            socket.emit("error_message", { message: "Failed to send group message." });
        }
    });

    // Private message
    socket.on("private_message", async ({ from_user, to_user, message }) => {
        try {
            if (!from_user || !to_user || !message) return;

            const saved = await PrivateMessage.create({
                from_user,
                to_user,
                message,
                date_sent: formatDate()
            });

            // send to sender
            socket.emit("private_message", saved);

            // send to recipient if online
            const toSocketId = userToSocket.get(to_user);
            if (toSocketId) io.to(toSocketId).emit("private_message", saved);
        } catch (err) {
            socket.emit("error_message", { message: "Failed to send private message." });
        }
    });

    socket.on("disconnect", () => {
        // remove disconnected socket from map
        for (const [username, sid] of userToSocket.entries()) {
            if (sid === socket.id) {
                userToSocket.delete(username);
                break;
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`));

