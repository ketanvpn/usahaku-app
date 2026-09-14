import { Router, type IRouter } from "express";
import { handleExport } from "./backup/backup-export";
import { handleRestore, restoreBodyParser } from "./backup/backup-restore";
import { requireAuth } from "../middlewares/auth";

const router: IRouter = Router();

router.get("/backup/export", requireAuth, handleExport);
router.post("/backup/restore", restoreBodyParser, requireAuth, handleRestore);

export default router;
