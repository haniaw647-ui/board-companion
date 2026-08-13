// Vercel serverless function: POST /api/claude
// Keeps your Anthropic API key on the server (never sent to the browser)
// and avoids CORS issues from calling api.anthropic.com directly from the app.
//
// Local dev: `vercel dev` runs this function locally alongside Vite.
// Deployed: Vercel picks this up automatically from the /api folder.
//
// Set ANTHROPIC_API_KEY in your environment (.env for local `vercel dev`,
// or Project Settings -> Environment Variables once deployed).

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

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

    if (!anthropicRes.ok) {
      res.status(anthropicRes.status).json(data);
      return;
    }

    res.status(200).json(data);
  } catch (err) {
    console.error("Claude proxy error:", err);
    res.status(500).json({ error: "Failed to reach Claude API." });
  }
}
