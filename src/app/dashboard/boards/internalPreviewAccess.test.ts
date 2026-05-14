import { canAccessInternalPreview } from "./internalPreviewAccess";

describe("canAccessInternalPreview", () => {
  it("returns true for isAdmin true", () => {
    expect(canAccessInternalPreview({ isAdmin: true })).toBe(true);
  });

  it("returns true for isDev true", () => {
    expect(canAccessInternalPreview({ isDev: true })).toBe(true);
  });

  it("returns true for role admin", () => {
    expect(canAccessInternalPreview({ role: "admin" })).toBe(true);
    expect(canAccessInternalPreview({ role: "ADMIN" })).toBe(true);
  });

  it("returns true for role dev", () => {
    expect(canAccessInternalPreview({ role: "dev" })).toBe(true);
    expect(canAccessInternalPreview({ role: " DEV " })).toBe(true);
  });

  it("returns false for common roles", () => {
    expect(canAccessInternalPreview({ role: "user" })).toBe(false);
    expect(canAccessInternalPreview({ role: "guest" })).toBe(false);
  });

  it("returns false for missing user", () => {
    expect(canAccessInternalPreview(null)).toBe(false);
    expect(canAccessInternalPreview(undefined)).toBe(false);
  });
});
