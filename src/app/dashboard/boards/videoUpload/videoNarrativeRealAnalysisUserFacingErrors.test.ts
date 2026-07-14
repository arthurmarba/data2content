import {
  getAllVideoNarrativeRealAnalysisUserFacingMessages,
  getVideoNarrativeRealAnalysisUserFacingMessage,
  resolveVideoNarrativeRealAnalysisUserFacingErrorCode,
} from "./videoNarrativeRealAnalysisUserFacingErrors";

describe("videoNarrativeRealAnalysisUserFacingErrors", () => {
  it("mapeia cada código para mensagem humana", () => {
    const messages = getAllVideoNarrativeRealAnalysisUserFacingMessages();

    expect(messages.usage_limit_reached).toContain("limite");
    expect(messages.beta_access_required).toContain("beta fechado");
    expect(messages.storage_download_failed).toContain("vídeo");
    expect(messages.video_too_large).toContain("tamanho máximo");
    expect(messages.gemini_timeout).toContain("demorou");
    expect(messages.cleanup_warning).toContain("limpeza");
  });

  it("não expõe secrets, uploadUrl ou objectKey nas mensagens", () => {
    const serialized = JSON.stringify(getAllVideoNarrativeRealAnalysisUserFacingMessages());

    expect(serialized).not.toMatch(/api[_ -]?key/i);
    expect(serialized).not.toMatch(/secret/i);
    expect(serialized).not.toMatch(/uploadUrl/i);
    expect(serialized).not.toMatch(/objectKey/i);
    expect(serialized).not.toMatch(/stack/i);
  });

  it("normaliza códigos internos para mensagens seguras", () => {
    expect(resolveVideoNarrativeRealAnalysisUserFacingErrorCode("gemini_user_not_allowed")).toBe(
      "beta_access_required",
    );
    expect(getVideoNarrativeRealAnalysisUserFacingMessage("download_failed")).toBe(
      "Não conseguimos ler o vídeo temporário agora. Tente novamente em alguns minutos.",
    );
    expect(resolveVideoNarrativeRealAnalysisUserFacingErrorCode("gemini_file_upload_failed")).toBe(
      "storage_not_ready",
    );
    expect(resolveVideoNarrativeRealAnalysisUserFacingErrorCode("gemini_file_permission_denied")).toBe(
      "gemini_provider_unavailable",
    );
    expect(resolveVideoNarrativeRealAnalysisUserFacingErrorCode("gemini_permission_denied")).toBe(
      "gemini_provider_unavailable",
    );
    expect(resolveVideoNarrativeRealAnalysisUserFacingErrorCode("object_too_large")).toBe(
      "video_too_large",
    );
    expect(getVideoNarrativeRealAnalysisUserFacingMessage("unknown-provider-stack")).toBe(
      "Não foi possível concluir a análise real agora.",
    );
  });
});
