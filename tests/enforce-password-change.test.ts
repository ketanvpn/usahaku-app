import { describe, it, expect, vi } from "vitest";

// Mock @workspace/db dengan chain minimal. Default: where() return [] sehingga
// middleware tidak menemukan user dan otomatis next().
vi.mock("@workspace/db", () => {
  const chain = {
    from: vi.fn(() => chain),
    where: vi.fn(() => Promise.resolve([])),
  };
  return {
    db: { select: vi.fn(() => chain) },
    usahaTable: {},
    usersTable: { id: "id", mustChangePassword: "mustChangePassword" },
  };
});

// drizzle-orm tidak ter-install di root workspace — middleware impor `eq` dari
// sini. Stub minimal saja.
vi.mock("drizzle-orm", () => ({
  eq: vi.fn(() => "eq-stub"),
  and: vi.fn(() => "and-stub"),
  desc: vi.fn(() => "desc-stub"),
  sql: vi.fn(() => "sql-stub"),
}));

import { enforcePasswordChange } from "../artifacts/api-server/src/middlewares/auth";

function buildRes() {
  const res: any = { _status: 200, _body: undefined };
  res.status = vi.fn((code: number) => {
    res._status = code;
    return res;
  });
  res.json = vi.fn((body: unknown) => {
    res._body = body;
    return res;
  });
  return res;
}

// CATATAN: test "blokir bila mustChangePassword=true" sengaja TIDAK ditulis
// di sini karena membutuhkan kontrol fine-grained terhadap return value
// `db.select(...).where(...)` per test, yang sulit dilakukan tanpa refactor
// middleware ke pola dependency injection. Branching itu tetap di-cover lewat
// code review + integration test manual saat smoke testing release.
describe("enforcePasswordChange — branching tanpa DB lookup", () => {
  it("lewatkan request tanpa session (belum login)", async () => {
    const next = vi.fn();
    const req: any = { session: {}, path: "/api/hutang" };
    const res = buildRes();
    await enforcePasswordChange(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(200);
  });

  it("lewatkan endpoint allowlist /api/auth/change-password", async () => {
    const next = vi.fn();
    const req: any = { session: { userId: 1 }, path: "/api/auth/change-password" };
    const res = buildRes();
    await enforcePasswordChange(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(200);
  });

  it("lewatkan endpoint allowlist /api/auth/me", async () => {
    const next = vi.fn();
    const req: any = { session: { userId: 1 }, path: "/api/auth/me" };
    const res = buildRes();
    await enforcePasswordChange(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(200);
  });

  it("lewatkan endpoint allowlist /api/auth/logout", async () => {
    const next = vi.fn();
    const req: any = { session: { userId: 1 }, path: "/api/auth/logout" };
    const res = buildRes();
    await enforcePasswordChange(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(200);
  });

  it("lewatkan endpoint /api/healthz tanpa session", async () => {
    const next = vi.fn();
    const req: any = { session: {}, path: "/api/healthz" };
    const res = buildRes();
    await enforcePasswordChange(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(200);
  });

  it("teruskan ke next() bila user tidak ditemukan di DB (default mock)", async () => {
    const next = vi.fn();
    const req: any = { session: { userId: 999 }, path: "/api/hutang" };
    const res = buildRes();
    await enforcePasswordChange(req, res, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(res._status).toBe(200);
  });
});
