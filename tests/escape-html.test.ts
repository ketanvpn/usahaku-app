import { describe, it, expect } from "vitest";
import { escapeHtml } from "../artifacts/hutang-app/src/lib/format";

describe("escapeHtml", () => {
  it("escapes basic HTML special characters", () => {
    expect(escapeHtml("<script>alert(1)</script>")).toBe(
      "&lt;script&gt;alert(1)&lt;/script&gt;",
    );
  });

  it("escapes ampersand, quotes, and apostrophe", () => {
    expect(escapeHtml(`A & B "hello" 'world'`)).toBe(
      "A &amp; B &quot;hello&quot; &#39;world&#39;",
    );
  });

  it("returns empty string for null and undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });

  it("coerces numbers to string without modification", () => {
    expect(escapeHtml(123)).toBe("123");
  });
});
