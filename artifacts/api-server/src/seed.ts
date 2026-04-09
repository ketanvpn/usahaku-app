import bcrypt from "bcrypt";
import { db, usahaTable, usersTable, pelangganTable, hutangTable, pembayaranTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logger } from "./lib/logger";

async function seed() {
  logger.info("Starting seed...");

  const existingAdmin = await db.select().from(usersTable).where(eq(usersTable.username, "admin"));
  if (existingAdmin.length > 0) {
    logger.info("Seed data already exists. Skipping.");
    return;
  }

  const [usaha] = await db.insert(usahaTable).values({
    namaUsaha: "Toko Sembako Barokah",
    alamat: "Jl. Merdeka No. 10, Bandung",
    telepon: "022-12345678",
    catatan: "Toko sembako dan kebutuhan sehari-hari",
  }).returning();

  const adminHash = await bcrypt.hash("admin123", 10);
  await db.insert(usersTable).values({
    nama: "Super Admin",
    username: "admin",
    passwordHash: adminHash,
    role: "super_admin",
    usahaId: null,
    isActive: true,
  });

  const ownerHash = await bcrypt.hash("owner123", 10);
  await db.insert(usersTable).values({
    nama: "Budi Santoso",
    username: "owner1",
    passwordHash: ownerHash,
    role: "owner",
    usahaId: usaha.id,
    isActive: true,
  });

  const [sari] = await db.insert(pelangganTable).values({
    usahaId: usaha.id,
    nama: "Sari Dewi",
    telepon: "081234567890",
    alamat: "Jl. Sudirman No. 5, Bandung",
    catatan: "Pelanggan tetap",
  }).returning();

  const [rudi] = await db.insert(pelangganTable).values({
    usahaId: usaha.id,
    nama: "Rudi Hartono",
    telepon: "082345678901",
    alamat: "Jl. Gatot Subroto No. 12, Bandung",
    catatan: null,
  }).returning();

  const [yanti] = await db.insert(pelangganTable).values({
    usahaId: usaha.id,
    nama: "Yanti Susanto",
    telepon: "083456789012",
    alamat: "Jl. Ahmad Yani No. 7, Bandung",
    catatan: "Langganan bulanan",
  }).returning();

  const today = new Date();
  const dateStr = (offset: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - offset);
    return d.toISOString().split("T")[0];
  };

  const [h1] = await db.insert(hutangTable).values({
    usahaId: usaha.id,
    pelangganId: sari.id,
    tanggalHutang: dateStr(30),
    keterangan: "Sembako bulan lalu",
    nominalHutang: "500000",
    totalDibayar: "200000",
    sisaHutang: "300000",
    status: "aktif",
  }).returning();

  const [h2] = await db.insert(hutangTable).values({
    usahaId: usaha.id,
    pelangganId: sari.id,
    tanggalHutang: dateStr(10),
    keterangan: "Belanja mingguan",
    nominalHutang: "150000",
    totalDibayar: "150000",
    sisaHutang: "0",
    status: "lunas",
  }).returning();

  const [h3] = await db.insert(hutangTable).values({
    usahaId: usaha.id,
    pelangganId: rudi.id,
    tanggalHutang: dateStr(15),
    keterangan: "Minyak goreng dan beras",
    nominalHutang: "350000",
    totalDibayar: "100000",
    sisaHutang: "250000",
    status: "aktif",
  }).returning();

  await db.insert(hutangTable).values({
    usahaId: usaha.id,
    pelangganId: yanti.id,
    tanggalHutang: dateStr(5),
    keterangan: "Kebutuhan dapur",
    nominalHutang: "275000",
    totalDibayar: "0",
    sisaHutang: "275000",
    status: "aktif",
  });

  await db.insert(pembayaranTable).values({
    usahaId: usaha.id,
    hutangId: h1.id,
    pelangganId: sari.id,
    tanggalBayar: dateStr(20),
    nominalBayar: "200000",
    catatan: "Bayar sebagian",
  });

  await db.insert(pembayaranTable).values({
    usahaId: usaha.id,
    hutangId: h2.id,
    pelangganId: sari.id,
    tanggalBayar: dateStr(5),
    nominalBayar: "150000",
    catatan: "Lunas",
  });

  await db.insert(pembayaranTable).values({
    usahaId: usaha.id,
    hutangId: h3.id,
    pelangganId: rudi.id,
    tanggalBayar: dateStr(7),
    nominalBayar: "100000",
    catatan: "Cicilan pertama",
  });

  logger.info("Seed completed successfully.");
}

export { seed };
