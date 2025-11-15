import express from "express";
import axios from "axios";
import dotenv from "dotenv";
import cors from "cors";
import db from "./database.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 8080;
const SPOTIFY_REDIRECT_URI = process.env.REDIRECT_URI;
const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID;
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET;

if (!SPOTIFY_REDIRECT_URI || !CLIENT_ID || !CLIENT_SECRET) {
    console.warn("Missing Spotify OAuth environment variables.");
}

// ------------------ LOGIN ------------------
app.get("/login", (req, res) => {
    const scope = "user-read-private user-read-email";
    const redirect =
        "https://accounts.spotify.com/authorize" +
        `?client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(scope)}`;

    res.redirect(redirect);
});

// ------------------ CALLBACK ------------------
app.get("/callback", async (req, res) => {
    const code = req.query.code;

    if (!code) {
        return res.status(400).send("Missing authorization code");
    }

    try {
        const tokenResponse = await axios.post(
            "https://accounts.spotify.com/api/token",
            new URLSearchParams({
                grant_type: "authorization_code",
                code,
                redirect_uri: SPOTIFY_REDIRECT_URI,
                client_id: CLIENT_ID,
                client_secret: CLIENT_SECRET,
            }),
            { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
        );

        const { access_token, refresh_token } = tokenResponse.data;

        await db.query(
            "INSERT INTO link_request (code, access_token, refresh_token, created_at) VALUES ($1, $2, $3, NOW())",
            [code, access_token, refresh_token]
        );

        res.send("Spotify tokens stored successfully.");
    } catch (err) {
        console.error("Error during callback:", err.response?.data || err);
        res.status(500).send("Failed to exchange Spotify code.");
    }
});

// ------------------ GET TOKEN ------------------
app.get("/get-token", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: "Missing ?code" });
    try {
        const result = await db.query(
            "SELECT access_token, refresh_token FROM link_request WHERE code = $1 ORDER BY id DESC LIMIT 1",
            [code]
        );
        if (result.rows.length === 0) return res.status(404).json({ error: "Code not found" });
        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

app.listen(PORT, () => console.log("Server running on port " + PORT));
