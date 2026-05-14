import express, { type Express } from "express";
import cors, { type CorsOptions } from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";
import { resolveSecret } from "./lib/security-secrets";

const app: Express = express();

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

// Whitelist origin: default ke localhost/127.0.0.1 (Electron + dev Vite).
// Tambah origin lain via env CORS_ORIGINS (comma-separated) bila perlu.
const defaultAllowedOrigins = [
  "http://localhost",
  "http://127.0.0.1",
];

const extraAllowedOrigins = (process.env.CORS_ORIGINS ?? "")
  .split(",")
  .map((o) => o.trim())
  .filter((o) => o.length > 0);

const allowedOriginPrefixes = [...defaultAllowedOrigins, ...extraAllowedOrigins];

const corsOptions: CorsOptions = {
  credentials: true,
  origin(origin, callback) {
    // Request same-origin atau dari Electron file:// tidak mengirim Origin header.
    if (!origin) {
      callback(null, true);
      return;
    }
    const ok = allowedOriginPrefixes.some((prefix) => origin === prefix || origin.startsWith(prefix + ":") || origin.startsWith(prefix + "/"));
    if (ok) {
      callback(null, true);
    } else {
      callback(new Error(`Origin tidak diizinkan oleh kebijakan CORS: ${origin}`));
    }
  },
};

app.use(cors(corsOptions));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const sessionSecret = resolveSecret({
  key: "SESSION_SECRET",
  value: process.env.SESSION_SECRET,
  fallback: "hutang-app-secret-key-change-in-production",
  reason: "dipakai untuk menandatangani session cookie",
});

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
      sameSite: "lax",
      maxAge: 7 * 24 * 60 * 60 * 1000,
    },
  })
);

app.use("/api", (_req, res, next) => {
  res.set("Cache-Control", "no-store");
  next();
});
app.use("/api", router);

if (process.env.SERVE_STATIC === "true") {
  const staticPath =
    process.env.STATIC_PATH ||
    path.join(path.dirname(new URL(import.meta.url).pathname), "../../hutang-app/dist/public");

  if (fs.existsSync(staticPath)) {
    app.use(express.static(staticPath));

    app.use((_req, res) => {
      res.sendFile(path.join(staticPath, "index.html"));
    });

    logger.info({ staticPath }, "Serving static frontend files");
  } else {
    logger.warn(
      { staticPath },
      "SERVE_STATIC=true but static path not found — frontend not served"
    );
  }
}

export default app;
