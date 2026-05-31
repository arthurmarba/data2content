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

  it("allows authenticated local users when the local preview bypass is enabled", () => {
    expect(
      canAccessInternalPreview(
        { role: "user" },
        {
          NODE_ENV: "development",
          MOBILE_STRATEGIC_PROFILE_LOCAL_PREVIEW_BYPASS: "1",
        },
      ),
    ).toBe(true);
  });

  it("does not allow the local preview bypass in production", () => {
    expect(
      canAccessInternalPreview(
        { role: "user" },
        {
          NODE_ENV: "production",
          MOBILE_STRATEGIC_PROFILE_LOCAL_PREVIEW_BYPASS: "1",
        },
      ),
    ).toBe(false);
  });

  it("does not allow the local preview bypass without a user", () => {
    expect(
      canAccessInternalPreview(null, {
        NODE_ENV: "development",
        MOBILE_STRATEGIC_PROFILE_LOCAL_PREVIEW_BYPASS: "1",
      }),
    ).toBe(false);
  });

  it("returns false for missing user", () => {
    expect(canAccessInternalPreview(null)).toBe(false);
    expect(canAccessInternalPreview(undefined)).toBe(false);
  });
});
