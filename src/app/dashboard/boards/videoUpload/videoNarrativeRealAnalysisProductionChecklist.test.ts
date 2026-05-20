import fs from "fs";
import path from "path";

describe("VIDEO_NARRATIVE_REAL_ANALYSIS_PRODUCTION_CHECKLIST", () => {
  const checklistPath = path.join(__dirname, "VIDEO_NARRATIVE_REAL_ANALYSIS_PRODUCTION_CHECKLIST.md");
  const checklist = fs.readFileSync(checklistPath, "utf8");

  it("existe e menciona envs obrigatórias de beta", () => {
    expect(checklist).toContain("GEMINI_API_KEY");
    expect(checklist).toContain("VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET");
    expect(checklist).toContain("VIDEO_NARRATIVE_REAL_ANALYSIS_BETA_LIMITS_ENABLED");
  });

  it("menciona rollback flags e usuários comuns bloqueados", () => {
    expect(checklist).toContain("Rollback rápido");
    expect(checklist).toContain("usuário comum");
    expect(checklist).toContain("/api/dashboard/mobile-strategic-profile/analyze");
  });

  it("menciona rotação de secrets sem valores reais", () => {
    expect(checklist).toContain("Rotação/revogação de secrets");
    expect(checklist).not.toMatch(/AIza|cfat_|SECRET_ACCESS_KEY=/);
  });
});
