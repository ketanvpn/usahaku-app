import { describe, it, expect, vi } from "vitest";
import { requireLoopback } from "../artifacts/api-server/src/middlewares/auth";

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

describe("requireLoopback", () => {
  it("allows IPv4 loopback", () => {
    const next = vi.fn();
    const req: any = { socket: { remoteAddress: "127.0.0.1" } };
    requireLoopback(req, buildRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows IPv6 loopback", () => {
    const next = vi.fn();
    const req: any = { socket: { remoteAddress: "::1" } };
    requireLoopback(req, buildRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("allows IPv4-mapped IPv6 loopback", () => {
    const next = vi.fn();
    const req: any = { socket: { remoteAddress: "::ffff:127.0.0.1" } };
    requireLoopback(req, buildRes(), next);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it("rejects external IP", () => {
    const next = vi.fn();
    const req: any = { socket: { remoteAddress: "192.168.1.10" } };
    const res = buildRes();
    requireLoopback(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
    expect(res._body).toMatchObject({ error: expect.any(String) });
  });

  it("rejects empty remote address", () => {
    const next = vi.fn();
    const req: any = { socket: {} };
    const res = buildRes();
    requireLoopback(req, res, next);
    expect(next).not.toHaveBeenCalled();
    expect(res._status).toBe(403);
  });
});
