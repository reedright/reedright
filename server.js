// Production server. Same as react-router-serve, plus `trust proxy` so request URLs carry the real
// scheme and host behind Railway's proxy (React Router's action CSRF check compares Origin to the URL).
import { createRequestHandler } from "@react-router/express";
import compression from "compression";
import express from "express";

const build = await import("./build/server/index.js");
const app = express();
app.set("trust proxy", true);
app.disable("x-powered-by");
app.use(compression());
// CORS preflights for the OAuth and MCP endpoints (React Router does not route OPTIONS to actions).
app.options(["/mcp", "/oauth/*", "/.well-known/*"], (_req, res) => {
  res.set({
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, mcp-protocol-version, mcp-session-id",
    "Access-Control-Max-Age": "86400",
  });
  res.status(204).end();
});
app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
app.use(express.static("build/client", { maxAge: "1h" }));
app.all("*", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const port = Number(process.env.PORT ?? 3000);
const server = app.listen(port, "0.0.0.0", () => console.log(`reedright listening on :${port}`));

// Railway stops a replaced container with SIGTERM. Without a handler Node exits 143, pnpm reports
// "ELIFECYCLE Command failed", and Railway counts the deploy as crashed. Close and exit cleanly instead.
for (const signal of ["SIGTERM", "SIGINT"]) {
  process.on(signal, () => {
    console.log(`${signal} received, shutting down`);
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
