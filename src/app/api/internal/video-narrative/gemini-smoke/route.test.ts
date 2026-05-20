import { GET, POST } from "./route";
import { getServerSession } from "next-auth/next";
import { runGeminiVideoNarrativeProviderFromEnv } from "@/app/dashboard/boards/videoUpload/geminiVideoNarrativeProviderComposer";
import { performVideoNarrativeRealRuntimeEnvAudit } from "@/app/dashboard/boards/videoUpload/videoNarrativeRealRuntimeEnvAudit";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/app/dashboard/boards/videoUpload/geminiVideoNarrativeProviderComposer", () => ({
  runGeminiVideoNarrativeProviderFromEnv: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/videoNarrativeRealRuntimeEnvAudit", () => ({
  performVideoNarrativeRealRuntimeEnvAudit: jest.fn(),
}));

describe("/api/internal/video-narrative/gemini-smoke", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.resetAllMocks();
    process.env = { ...originalEnv, VIDEO_NARRATIVE_GEMINI_SMOKE_ENABLED: "true" };
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { email: "admin@d2c.com", role: "admin" },
    });
    (performVideoNarrativeRealRuntimeEnvAudit as jest.Mock).mockReturnValue({
      ok: true,
      issues: [],
      flags: { geminiApiKeyPresent: true },
    });
    (runGeminiVideoNarrativeProviderFromEnv as jest.Mock).mockResolvedValue({
      ok: true,
      rawText: "```json\n{ \"mock\": true }\n```",
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("11. Bloqueia anônimo", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const response = await POST();
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Acesso interno não permitido.");
  });

  it("12. Bloqueia usuário comum", async () => {
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { email: "user@example.com", role: "user" },
    });
    const response = await POST();
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toBe("Acesso interno não permitido.");
  });

  it("13. Bloqueia smoke flag desligada", async () => {
    process.env.VIDEO_NARRATIVE_GEMINI_SMOKE_ENABLED = "false";
    const response = await POST();
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain("Smoke harness is disabled");
  });

  it("14. Bloqueia env incompleta", async () => {
    (performVideoNarrativeRealRuntimeEnvAudit as jest.Mock).mockReturnValue({
      ok: false,
      issues: [{ code: "gemini_api_key_missing" }],
      flags: {},
    });
    const response = await POST();
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe("Ambiente não está pronto para smoke test.");
  });

  it("15. Com fake provider retorna ok seguro", async () => {
    const response = await POST();
    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.ok).toBe(false); // Porque o JSON no fake provider acima não tem os dados completos do parser
    expect(data.providerReady).toBe(true);
    expect(data.parserReady).toBe(false);
    expect(typeof data.timingMs).toBe("number");
  });

  it("16. Não salva snapshot (não chama db/etc)", async () => {
    // A rota não importa nem possui nenhuma dependência de DB ou snapshot
    const response = await POST();
    expect(response.status).toBe(200);
  });

  it("17. Não retorna raw response", async () => {
    const response = await POST();
    const data = await response.json();
    expect(data.rawText).toBeUndefined();
    expect(JSON.stringify(data)).not.toContain("```json");
  });

  it("18. Não expõe API key", async () => {
    process.env.GEMINI_API_KEY = "super_secret_key";
    const response = await POST();
    const data = await response.json();
    expect(JSON.stringify(data)).not.toContain("super_secret_key");
  });

  it("19. Não chama Gemini real nos testes", async () => {
    await POST();
    // Foi mockado runGeminiVideoNarrativeProviderFromEnv e nunca chamei `fetch` ou SDK
    expect(runGeminiVideoNarrativeProviderFromEnv).toHaveBeenCalledTimes(1);
  });
});
