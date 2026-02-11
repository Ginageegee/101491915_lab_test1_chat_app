$("#btnLogin").on("click", async () => {
    $("#msg").text("");

    const payload = {
        username: $("#username").val().trim(),
        password: $("#password").val()
    };

    try {
        const res = await fetch("/api/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) return $("#msg").text(data.message || "Login failed");

        // required by lab: localStorage session
        localStorage.setItem("chat_user", JSON.stringify(data.user));
        localStorage.setItem("chat_rooms", JSON.stringify(data.rooms));

        window.location.href = "/views/chat.html";
    } catch (e) {
        $("#msg").text("Network error");
    }
});
