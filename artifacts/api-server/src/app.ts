import express, { type Express } from "express";
import cors from "cors";
import pinoHttp from "pino-http";
import cookieParser from "cookie-parser";
import session from "express-session";
import path from "path";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

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

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

const sessionSecret = process.env.SESSION_SECRET || "hutang-app-secret-key-change-in-production";

app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false,
      httpOnly: true,
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
