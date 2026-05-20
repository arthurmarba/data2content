import { evaluateVideoNarrativeSignedUploadAllowlist } from "./videoNarrativeTemporaryStorageAllowlist";

const enabledEnv = {
  VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "1",
};

describe("videoNarrativeTemporaryStorageAllowlist", () => {
  it("allows admin/dev users", () => {
    expect(evaluateVideoNarrativeSignedUploadAllowlist({ user: { id: "u1", role: "admin" }, env: enabledEnv }).ok).toBe(true);
    expect(evaluateVideoNarrativeSignedUploadAllowlist({ user: { id: "u2", isDev: true }, env: enabledEnv }).ok).toBe(true);
  });

  it("allows emails listed in env", () => {
    const result = evaluateVideoNarrativeSignedUploadAllowlist({
      user: { id: "u1", email: "Creator@Example.com" },
      env: {
        ...enabledEnv,
        VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS: "creator@example.com",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("allows user IDs listed in env", () => {
    const result = evaluateVideoNarrativeSignedUploadAllowlist({
      user: { id: "usr_allowed", email: "common@example.com" },
      env: {
        ...enabledEnv,
        VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_USER_IDS: "usr_allowed",
      },
    });

    expect(result.ok).toBe(true);
  });

  it("blocks common users", () => {
    const result = evaluateVideoNarrativeSignedUploadAllowlist({
      user: { id: "usr_common", email: "common@example.com", role: "creator" },
      env: enabledEnv,
    });

    expect(result.ok).toBe(false);
  });

  it("blocks common users when allowlist env is empty", () => {
    const result = evaluateVideoNarrativeSignedUploadAllowlist({
      user: { id: "usr_common", email: "common@example.com" },
      env: enabledEnv,
    });

    expect(result.ok).toBe(false);
  });

  it("does not expose allowlisted emails or user IDs in errors", () => {
    const result = evaluateVideoNarrativeSignedUploadAllowlist({
      user: { id: "usr_common", email: "common@example.com" },
      env: {
        ...enabledEnv,
        VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS: "sensitive@example.com",
        VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_USER_IDS: "usr_sensitive",
      },
    });

    expect(JSON.stringify(result)).not.toContain("sensitive@example.com");
    expect(JSON.stringify(result)).not.toContain("usr_sensitive");
  });
});
