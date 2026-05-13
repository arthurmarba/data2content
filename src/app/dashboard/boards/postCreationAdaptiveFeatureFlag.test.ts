import {
  getPostCreationAdaptiveLocalOverride,
  isPostCreationAdaptiveEnvEnabled,
  isPostCreationAdaptiveTester,
  setPostCreationAdaptiveLocalOverride,
  shouldShowPostCreationAdaptiveExperience,
} from "./postCreationAdaptiveFeatureFlag";

const ENV_KEY = "NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED";
const STORAGE_KEY = "d2c:postCreationAdaptiveEnabled";

const originalEnvValue = process.env[ENV_KEY];

function searchParams(query: string) {
  return new URLSearchParams(query);
}

describe("postCreationAdaptiveFeatureFlag", () => {
  afterEach(() => {
    if (typeof originalEnvValue === "string") {
      process.env[ENV_KEY] = originalEnvValue;
    } else {
      delete process.env[ENV_KEY];
    }
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it("enables globally when env flag is 1", () => {
    process.env[ENV_KEY] = "1";

    expect(isPostCreationAdaptiveEnvEnabled()).toBe(true);
    expect(shouldShowPostCreationAdaptiveExperience({ role: "user" })).toBe(true);
  });

  it("does not enable globally when env flag is absent or off", () => {
    delete process.env[ENV_KEY];
    expect(isPostCreationAdaptiveEnvEnabled()).toBe(false);

    process.env[ENV_KEY] = "0";
    expect(isPostCreationAdaptiveEnvEnabled()).toBe(false);
  });

  it("treats admin as tester", () => {
    expect(isPostCreationAdaptiveTester({ role: "admin" })).toBe(true);
  });

  it("treats dev as tester", () => {
    expect(isPostCreationAdaptiveTester({ role: "dev" })).toBe(true);
  });

  it("does not treat common user as tester", () => {
    expect(isPostCreationAdaptiveTester({ role: "user" })).toBe(false);
    expect(isPostCreationAdaptiveTester({ role: null })).toBe(false);
  });

  it("does not enable common user with adaptiveBoard=1", () => {
    delete process.env[ENV_KEY];

    expect(
      shouldShowPostCreationAdaptiveExperience({
        role: "user",
        searchParams: searchParams("adaptiveBoard=1"),
      }),
    ).toBe(false);
    expect(getPostCreationAdaptiveLocalOverride()).toBe(false);
  });

  it("enables admin with adaptiveBoard=1", () => {
    delete process.env[ENV_KEY];

    expect(
      shouldShowPostCreationAdaptiveExperience({
        role: "admin",
        searchParams: searchParams("adaptiveBoard=1"),
      }),
    ).toBe(true);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe("1");
  });

  it("disables admin with adaptiveBoard=0", () => {
    delete process.env[ENV_KEY];
    setPostCreationAdaptiveLocalOverride(true);

    expect(
      shouldShowPostCreationAdaptiveExperience({
        role: "admin",
        searchParams: searchParams("adaptiveBoard=0"),
      }),
    ).toBe(false);
    expect(window.localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("uses localStorage override for admin or dev", () => {
    delete process.env[ENV_KEY];
    setPostCreationAdaptiveLocalOverride(true);

    expect(shouldShowPostCreationAdaptiveExperience({ role: "admin" })).toBe(true);
    expect(shouldShowPostCreationAdaptiveExperience({ role: "dev" })).toBe(true);
  });

  it("does not use localStorage override for common user", () => {
    delete process.env[ENV_KEY];
    setPostCreationAdaptiveLocalOverride(true);

    expect(shouldShowPostCreationAdaptiveExperience({ role: "user" })).toBe(false);
  });

  it("does not break when window is unavailable", () => {
    const originalWindow = global.window;
    Reflect.deleteProperty(global, "window");

    expect(getPostCreationAdaptiveLocalOverride()).toBe(false);
    expect(() => setPostCreationAdaptiveLocalOverride(true)).not.toThrow();

    Object.defineProperty(global, "window", {
      configurable: true,
      value: originalWindow,
    });
  });

  it("setLocalOverride saves and removes correctly", () => {
    setPostCreationAdaptiveLocalOverride(true);
    expect(getPostCreationAdaptiveLocalOverride()).toBe(true);

    setPostCreationAdaptiveLocalOverride(false);
    expect(getPostCreationAdaptiveLocalOverride()).toBe(false);
  });
});
