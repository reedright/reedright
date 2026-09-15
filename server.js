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
app.use("/assets", express.static("build/client/assets", { immutable: true, maxAge: "1y" }));
app.use(express.static("build/client", { maxAge: "1h" }));
app.all("*", createRequestHandler({ build, mode: process.env.NODE_ENV }));

const port = Number(process.env.PORT ?? 3000);
app.listen(port, "0.0.0.0", () => console.log(`reedright listening on :${port}`));
