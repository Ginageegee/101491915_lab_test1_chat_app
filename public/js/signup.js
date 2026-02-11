$("#btnSignup").on("click", async () => {
    $("#msg").text("");

    const payload = {
        username: $("#username").val().trim(),
        firstname: $("#firstname").val().trim(),
        lastname: $("#lastname").val().trim(),
        password: $("#password").val()
    };

    try {
        const res = await fetch("/api/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (!res.ok) return $("#msg").text(data.message || "Signup failed");

        window.location.href = "/views/login.html";
    } catch (e) {
        $("#msg").text("Network error");
    }
});
