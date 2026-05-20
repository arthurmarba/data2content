import fs from "fs";
import path from "path";

describe("VIDEO_NARRATIVE_CLOSED_BETA_LAUNCH_CHECKLIST", () => {
  const checklist = fs.readFileSync(
    path.join(__dirname, "VIDEO_NARRATIVE_CLOSED_BETA_LAUNCH_CHECKLIST.md"),
    "utf8",
  );

  it("documenta envs obrigatórias e rollback", () => {
    expect(checklist).toContain("NEXT_PUBLIC_VIDEO_NARRATIVE_REAL_ANALYSIS_E2E_ENABLED");
    expect(checklist).toContain("VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED");
    expect(checklist).toContain("Como desativar rapidamente");
  });

  it("documenta allowlist e público geral bloqueado", () => {
    expect(checklist).toContain("VIDEO_NARRATIVE_GEMINI_ALLOWED_EMAILS");
    expect(checklist).toContain("VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS");
    expect(checklist).toContain("público geral permanece bloqueado");
  });

  it("não contém valores reais de secret", () => {
    expect(checklist).not.toMatch(/AIza|cfat_|BEGIN PRIVATE KEY|SECRET_ACCESS_KEY=/);
  });
});
