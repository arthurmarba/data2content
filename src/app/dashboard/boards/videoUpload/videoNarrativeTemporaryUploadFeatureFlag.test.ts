import {
  isTemporaryUploadSessionEnabled,
  isRealUploadEnabled,
} from "./videoNarrativeTemporaryUploadFeatureFlag";

describe("videoNarrativeTemporaryUploadFeatureFlag", () => {
  it("reconhece quando a flag de sessão está ativa (enabled)", () => {
    const env = { VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1" };
    expect(isTemporaryUploadSessionEnabled(env)).toBe(true);
  });

  it("reconhece quando a flag de sessão está inativa (disabled)", () => {
    const env = { VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "0" };
    expect(isTemporaryUploadSessionEnabled(env)).toBe(false);
  });

  it("reconhece quando o upload real está ativo (enabled)", () => {
    const env = { VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "true" };
    expect(isRealUploadEnabled(env)).toBe(true);
  });

  it("reconhece quando o upload real está inativo (disabled)", () => {
    const env = { VIDEO_NARRATIVE_REAL_UPLOAD_ENABLED: "false" };
    expect(isRealUploadEnabled(env)).toBe(false);
  });

  it("provider real permanece inativo (disabled) por padrão", () => {
    expect(isRealUploadEnabled({})).toBe(false);
    expect(isTemporaryUploadSessionEnabled({})).toBe(false);
  });
});
