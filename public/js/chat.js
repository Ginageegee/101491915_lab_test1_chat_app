const user = JSON.parse(localStorage.getItem("chat_user") || "null");
const rooms = JSON.parse(localStorage.getItem("chat_rooms") || "[]");

if (!user) window.location.href = "/views/login.html";

$("#whoami").text(`${user.firstname} ${user.lastname} (@${user.username})`);

let currentRoom = null;
let typingTimeout = null;

rooms.forEach(r => $("#roomSelect").append(`<option value="${r}">${r}</option>`));

const socket = io();
socket.emit("register_user", user.username);

function addMessage(html) {
    $("#messages").append(`<div class="msg">${html}</div>`);
    $("#messages").scrollTop($("#messages")[0].scrollHeight);
}

async function loadRoomHistory(room) {
    $("#messages").html("");
    const res = await fetch(`/api/messages/group/${encodeURIComponent(room)}`);
    const data = await res.json();
    data.messages.forEach(m => addMessage(`<b>${m.from_user}</b> [${m.date_sent}] : ${m.message}`));
}

$("#btnJoin").on("click", async () => {
    $("#msg").text("");
    const room = $("#roomSelect").val();
    currentRoom = room;
    $("#currentRoom").text(room);
    socket.emit("join_room", room);
    await loadRoomHistory(room);
});

$("#btnLeave").on("click", () => {
    $("#msg").text("");
    if (!currentRoom) return;
    socket.emit("leave_room", currentRoom);
    addMessage(`<span class="sys">You left ${currentRoom}</span>`);
    currentRoom = null;
    $("#currentRoom").text("none");
    $("#typing").text("");
});

$("#btnLogout").on("click", () => {
    localStorage.removeItem("chat_user");
    localStorage.removeItem("chat_rooms");
    window.location.href = "/views/login.html";
});

$("#messageInput").on("input", () => {
    if (!currentRoom) return;
    socket.emit("typing", { room: currentRoom, username: user.username, isTyping: true });

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit("typing", { room: currentRoom, username: user.username, isTyping: false });
    }, 700);
});

$("#btnSendGroup").on("click", () => {
    $("#msg").text("");
    const message = $("#messageInput").val().trim();
    if (!currentRoom) return $("#msg").text("Join a room first.");
    if (!message) return;

    socket.emit("group_message", { room: currentRoom, from_user: user.username, message });
    $("#messageInput").val("");
});

$("#btnSendPM").on("click", () => {
    $("#msg").text("");
    const message = $("#messageInput").val().trim();
    const to_user = $("#pmTo").val().trim();
    if (!to_user) return $("#msg").text("Enter to_user (username) first.");
    if (!message) return;

    socket.emit("private_message", { from_user: user.username, to_user, message });
    $("#messageInput").val("");
});

$("#btnLoadPM").on("click", async () => {
    $("#msg").text("");
    const to_user = $("#pmTo").val().trim();
    if (!to_user) return $("#msg").text("Enter to_user first.");

    $("#messages").html("");
    const res = await fetch(`/api/messages/private?u1=${encodeURIComponent(user.username)}&u2=${encodeURIComponent(to_user)}`);
    const data = await res.json();
    data.messages.forEach(m => addMessage(`<b>(PM) ${m.from_user} → ${m.to_user}</b> [${m.date_sent}] : ${m.message}`));
});

socket.on("typing", ({ username, isTyping }) => {
    if (isTyping) $("#typing").text(`${username} is typing...`);
    else $("#typing").text("");
});

socket.on("group_message", (m) => {
    addMessage(`<b>${m.from_user}</b> [${m.date_sent}] : ${m.message}`);
});

socket.on("private_message", (m) => {
    addMessage(`<b>(PM) ${m.from_user} → ${m.to_user}</b> [${m.date_sent}] : ${m.message}`);
});
