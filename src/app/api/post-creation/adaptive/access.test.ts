import { validatePostCreationAdaptiveServerAccess } from "./access";

const ENV_KEY = "NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED";
const originalEnvValue = process.env[ENV_KEY];

function sessionWithRole(role?: string | null) {
  return {
    user: {
      id: "user-1",
      role,
    },
  };
}

describe("validatePostCreationAdaptiveServerAccess", () => {
  afterEach(() => {
    if (typeof originalEnvValue === "string") {
      process.env[ENV_KEY] = originalEnvValue;
    } else {
      delete process.env[ENV_KEY];
    }
  });

  it("allows role user when env flag is enabled", () => {
    process.env[ENV_KEY] = "1";

    expect(validatePostCreationAdaptiveServerAccess({ session: sessionWithRole("user") })).toEqual({
      ok: true,
    });
  });

  it("allows role admin when env flag is enabled", () => {
    process.env[ENV_KEY] = "1";

    expect(validatePostCreationAdaptiveServerAccess({ session: sessionWithRole("admin") })).toEqual({
      ok: true,
    });
  });

  it("allows role admin when env flag is disabled", () => {
    delete process.env[ENV_KEY];

    expect(validatePostCreationAdaptiveServerAccess({ session: sessionWithRole("admin") })).toEqual({
      ok: true,
    });
  });

  it("allows role dev when env flag is disabled", () => {
    process.env[ENV_KEY] = "0";

    expect(validatePostCreationAdaptiveServerAccess({ session: sessionWithRole("dev") })).toEqual({
      ok: true,
    });
  });

  it("blocks role user when env flag is disabled", () => {
    delete process.env[ENV_KEY];

    expect(validatePostCreationAdaptiveServerAccess({ session: sessionWithRole("user") })).toMatchObject({
      ok: false,
      status: 403,
      error: "Experiência adaptativa indisponível.",
      reason: "post_creation_adaptive_disabled",
    });
  });

  it("blocks null or undefined role when env flag is disabled", () => {
    delete process.env[ENV_KEY];

    expect(validatePostCreationAdaptiveServerAccess({ session: sessionWithRole(null) })).toMatchObject({
      ok: false,
      status: 403,
      reason: "post_creation_adaptive_disabled",
    });
    expect(validatePostCreationAdaptiveServerAccess({ session: { user: { id: "user-1" } } })).toMatchObject({
      ok: false,
      status: 403,
      reason: "post_creation_adaptive_disabled",
    });
  });

  it("allows uppercase admin role when env flag is disabled", () => {
    delete process.env[ENV_KEY];

    expect(validatePostCreationAdaptiveServerAccess({ session: sessionWithRole("ADMIN") })).toEqual({
      ok: true,
    });
  });

  it("returns the expected blocked status and reason", () => {
    process.env[ENV_KEY] = "0";

    expect(validatePostCreationAdaptiveServerAccess({ session: sessionWithRole("creator") })).toEqual({
      ok: false,
      status: 403,
      error: "Experiência adaptativa indisponível.",
      reason: "post_creation_adaptive_disabled",
    });
  });
});
