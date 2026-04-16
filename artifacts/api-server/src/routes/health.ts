import { Router, type IRouter } from "express";
import { HealthCheckResponse } from "@workspace/api-zod";
import { sqliteRaw } from "@workspace/db";

const router: IRouter = Router();

router.get("/healthz", (_req, res) => {
  const data = HealthCheckResponse.parse({ status: "ok" });
  res.json(data);
});

// Endpoint internal: flush WAL ke file .db utama sebelum backup
// Tidak perlu auth — hanya bisa diakses dari localhost (Electron main process)
router.post("/internal/wal-checkpoint", (_req, res) => {
  try {
    sqliteRaw.pragma("wal_checkpoint(TRUNCATE)");
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ ok: false, error: String(e) });
  }
});

export default router;
