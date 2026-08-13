import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

// Local stand-in for the Vercel serverless function at api/claude.js —
// plain `npm run dev` (Vite alone) doesn't serve /api routes at all, and
// `vercel dev` needs an interactive `vercel login`/`vercel link` that
// isn't available in this environment. This middleware runs the exact
// same proxy logic directly inside Vite's dev server so /api/claude works
// locally without either. Not used in production — Vercel's own
// api/claude.js still handles the deployed site.
function localClaudeApiPlugin(env) {
  return {
    name: "local-api-claude",
    configureServer(server) {
      server.middlewares.use("/api/claude", (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end(JSON.stringify({ error: "Method not allowed" }));
          return;
        }
        const apiKey = env.ANTHROPIC_API_KEY;
        if (!apiKey) {
          res.statusCode = 500;
          res.end(JSON.stringify({ error: "ANTHROPIC_API_KEY is not set on the server." }));
          return;
        }
        let body = "";
        req.on("data", (chunk) => { body += chunk; });
        req.on("end", async () => {
          try {
            const { model, max_tokens, system, messages } = JSON.parse(body || "{}");
            const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                "x-api-key": apiKey,
                "anthropic-version": "2023-06-01",
              },
              body: JSON.stringify({ model: model || "claude-sonnet-5", max_tokens: max_tokens || 4000, system, messages }),
            });
            const data = await anthropicRes.json();
            res.statusCode = anthropicRes.status;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify(data));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: "Failed to reach Claude API." }));
          }
        });
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    plugins: [react(), localClaudeApiPlugin(env)],
    server: {
      port: process.env.PORT ? Number(process.env.PORT) : 5173,
    },
  };
});
