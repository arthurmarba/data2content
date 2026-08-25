import {
  calculatePkceChallenge,
  generateOpaqueOAuthToken,
  hashOpaqueOAuthToken,
  safeOAuthStringEqual,
} from "./crypto";

describe("MCP OAuth cryptographic helpers", () => {
  it("matches the RFC 7636 PKCE S256 example", () => {
    expect(calculatePkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk"))
      .toBe("E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  });

  it("generates high-entropy URL-safe opaque tokens", () => {
    const first = generateOpaqueOAuthToken(32);
    const second = generateOpaqueOAuthToken(32);
    expect(first).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first).not.toBe(second);
  });

  it("hashes tokens deterministically without retaining the raw value", () => {
    const raw = "refresh-token-value";
    expect(hashOpaqueOAuthToken(raw)).toBe(hashOpaqueOAuthToken(raw));
    expect(hashOpaqueOAuthToken(raw)).not.toContain(raw);
  });

  it("compares security-sensitive strings safely", () => {
    expect(safeOAuthStringEqual("same", "same")).toBe(true);
    expect(safeOAuthStringEqual("same", "different")).toBe(false);
  });
});
