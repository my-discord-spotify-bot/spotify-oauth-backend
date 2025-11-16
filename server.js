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
const SPOTIFY_TOKEN_URL = "https://accounts.spotify.com/api/token";

if (!SPOTIFY_REDIRECT_URI || !CLIENT_ID || !CLIENT_SECRET) {
    console.warn("Missing Spotify OAuth environment variables.");
}

/* ------------------ LOGIN ------------------ */
app.get("/login", (req, res) => {
    const state = req.query.state || "";
    const scope = "user-read-private user-read-email user-read-playback-state user-modify-playback-state";

    const redirect =
        "https://accounts.spotify.com/authorize" +
        `?client_id=${CLIENT_ID}` +
        `&response_type=code` +
        `&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}` +
        `&scope=${encodeURIComponent(scope)}` +
        (state ? `&state=${encodeURIComponent(state)}` : "");

    res.redirect(redirect);
});

/* ------------------ CALLBACK ------------------ */
app.get("/callback", async (req, res) => {
    const code = req.query.code;
    const state = req.query.state;

    if (!code) {
        return res.status(400).send("Missing authorization code");
    }

    try {
        const basicAuthToken = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

        const formData = new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: SPOTIFY_REDIRECT_URI,
        });

        const tokenResponse = await axios.post(SPOTIFY_TOKEN_URL, formData, {
            headers: {
                "Content-Type": "application/x-www-form-urlencoded",
                Authorization: `Basic ${basicAuthToken}`,
            },
        });

        const { access_token, refresh_token } = tokenResponse.data;

        const linkCode = state || code;

        await db.query(
            "INSERT INTO link_request (code, access_token, refresh_token, created_at) VALUES ($1, $2, $3, NOW())",
            [linkCode, access_token, refresh_token]
        );

        res.send("Spotify tokens stored successfully.");
    } catch (err) {
        console.error("Error during callback:", err.response?.data || err);
        res.status(500).send("Failed to exchange Spotify code.");
    }
});

/* ------------------ GET TOKEN ------------------ */
app.get("/get-token", async (req, res) => {
    const code = req.query.code;
    if (!code) return res.status(400).json({ error: "Missing ?code" });

    try {
        const result = await db.query(
            "SELECT access_token, refresh_token FROM link_request WHERE code = $1 ORDER BY id DESC LIMIT 1",
            [code]
        );

        if (result.rows.length === 0)
            return res.status(404).json({ error: "Code not found" });

        res.json(result.rows[0]);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: "Database error" });
    }
});

/* ------------------ REFRESH TOKEN ------------------ */
app.post("/refresh-token", async (req, res) => {
    const { refresh_token } = req.body;

    if (!refresh_token) {
        return res.status(400).json({ error: "Missing refresh_token" });
    }

    try {
        const basicAuthToken = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString("base64");

        const payload = new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token,
        });

        const { data } = await axios.post(
            "https://accounts.spotify.com/api/token",
            payload,
            {
                headers: {
                    "Content-Type": "application/x-www-form-urlencoded",
                    Authorization: `Basic ${basicAuthToken}`,
                },
            }
        );

        if (!data.access_token) {
            return res.status(502).json({ error: "Spotify did not return an access token" });
        }

        res.json({ access_token: data.access_token });
    } catch (error) {
        console.error("Refresh token error:", error.response?.data || error);
        res.status(500).json({ error: "Failed to refresh token" });
    }
});

/* ------------------ START SERVER ------------------ */
app.listen(PORT, () => {
    console.log("Server running on port " + PORT);
});

/* ------------------ UPDATE ACCOUNT ------------------ */
app.post("/update-account", async (req, res) => {
    const { userId, access_token } = req.body;

    if (!userId || !access_token) {
        return res.status(400).json({ error: "Missing userId or access_token" });
    }

    try {
        // Met à jour le token dans la table link_request
        const result = await db.query(
            "UPDATE link_request SET access_token = $1 WHERE code = $2 RETURNING *",
            [access_token, userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: "User not found" });
        }

        res.json(result.rows[0]);
    } catch (error) {
        console.error("Error updating account:", error);
        res.status(500).json({ error: "Failed to update account" });
    }
});

