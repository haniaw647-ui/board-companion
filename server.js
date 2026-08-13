// Production server for Railway (and any other host that runs a persistent
// Node process instead of Vercel-style serverless functions). Serves the
// built Vite app (dist/) as static files and handles POST /api/claude with
// the same proxy logic as api/claude.js — that file stays untouched so a
// Vercel deployment of this same repo keeps working unchanged.
import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());

app.post("/api/claude", async (req, res) => {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    res.status(500).json({ error: "ANTHROPIC_API_KEY is not set on the server." });
    return;
  }

  try {
    const { model, max_tokens, system, messages } = req.body || {};
    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: model || "claude-sonnet-5",
        max_tokens: max_tokens || 4000,
        system,
        messages,
      }),
    });
    const data = await anthropicRes.json();
    res.status(anthropicRes.status).json(data);
  } catch (err) {
    console.error("Claude proxy error:", err);
    res.status(500).json({ error: "Failed to reach Claude API." });
  }
});

const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));
app.get("/*splat", (req, res) => {
  res.sendFile(path.join(distPath, "index.html"));
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Board Companion listening on port ${port}`);
});
