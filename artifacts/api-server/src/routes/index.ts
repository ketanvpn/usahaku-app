import { Router, type IRouter } from "express";
import healthRouter from "./health";
import authRouter from "./auth";
import usahaRouter from "./usaha";
import usersRouter from "./users";
import pelangganRouter from "./pelanggan";
import hutangRouter from "./hutang";
import pembayaranRouter from "./pembayaran";
import dashboardRouter from "./dashboard";
import laporanRouter from "./laporan";
import backupRouter from "./backup";
import lisensiRouter from "./lisensi";
import keuanganRouter from "./keuangan";
import stokRouter from "./stok";
import setupRouter from "./setup";

const router: IRouter = Router();

router.use(setupRouter);
router.use(healthRouter);
router.use(authRouter);
router.use(usahaRouter);
router.use(usersRouter);
router.use(pelangganRouter);
router.use(hutangRouter);
router.use(pembayaranRouter);
router.use(dashboardRouter);
router.use(laporanRouter);
router.use(backupRouter);
router.use(lisensiRouter);
router.use(keuanganRouter);
router.use(stokRouter);

export default router;
