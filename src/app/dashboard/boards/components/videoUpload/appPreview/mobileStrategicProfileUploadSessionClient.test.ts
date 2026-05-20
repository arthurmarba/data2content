import {
  buildUploadSessionPayloadFromFile,
  requestUploadSession,
} from "./mobileStrategicProfileUploadSessionClient";

describe("mobileStrategicProfileUploadSessionClient", () => {
  beforeEach(() => {
    jest.restoreAllMocks();
    global.fetch = jest.fn();
  });

  const validPayload = {
    fileName: "vlog.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1024 * 1024 * 12,
    durationSeconds: null,
    userConsentAccepted: true,
    consentTextVersion: "video_narrative_upload_consent_v1",
    source: "mobile_strategic_profile" as const,
  };

  it("monta payload a partir do File usando apenas name, type e size", () => {
    const file = new File(["conteudo ignorado"], "daily vlog.mov", { type: "video/quicktime" });
    const payload = buildUploadSessionPayloadFromFile(file, true);

    expect(payload).toEqual({
      fileName: "daily vlog.mov",
      mimeType: "video/quicktime",
      sizeBytes: file.size,
      durationSeconds: null,
      userConsentAccepted: true,
      consentTextVersion: "video_narrative_upload_consent_v1",
      source: "mobile_strategic_profile",
    });
    expect(payload).not.toHaveProperty("file");
    expect(payload).not.toHaveProperty("bytes");
    expect(payload).not.toHaveProperty("base64");
    expect(payload).not.toHaveProperty("objectUrl");
    expect(payload).not.toHaveProperty("videoUrl");
  });

  it("monta payload apenas com name, type, size e consentimento e chama o endpoint correto", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        ok: true,
        status: "mock_session_created",
        uploadSession: { id: "session_123" },
      }),
    });
    global.fetch = mockFetch;

    const res = await requestUploadSession(validPayload);

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/dashboard/mobile-strategic-profile/upload-session",
      expect.objectContaining({
        method: "POST",
        body: expect.any(String),
      })
    );

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.fileName).toBe("vlog.mp4");
    expect(body.mimeType).toBe("video/mp4");
    expect(body.sizeBytes).toBe(12582912);
    expect(body.durationSeconds).toBeNull();
    expect(body.userConsentAccepted).toBe(true);
    expect(body.consentTextVersion).toBe("video_narrative_upload_consent_v1");
    expect(body.source).toBe("mobile_strategic_profile");

    // Garante que nenhum campo de arquivo real ou base64 foi inserido
    expect(body.file).toBeUndefined();
    expect(body.bytes).toBeUndefined();
    expect(body.base64).toBeUndefined();
    expect(body.objectUrl).toBeUndefined();
    expect(body.videoUrl).toBeUndefined();
    expect(body.thumbnailUrl).toBeUndefined();

    expect(res.ok).toBe(true);
    expect(res.status).toBe("mock_session_created");
  });

  it("reconhece signed_upload_session_created sem enviar file/bytes/base64/objectUrl", async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: jest.fn().mockResolvedValue({
        ok: true,
        status: "signed_upload_session_created",
        uploadSession: {
          id: "video-temp-upload-session-abc_123",
          providerMode: "real",
          storageProvider: "cloudflare_r2",
          uploadUrl: "https://signed.example.test/upload?signature=test",
          method: "PUT",
          headers: { "Content-Type": "video/mp4" },
          expiresAt: "2099-01-01T00:00:00.000Z",
          objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
          retentionTtlMinutes: 60,
          shouldDeleteAfterAnalysis: true,
          shouldPersistVideo: false,
          shouldPersistThumbnail: false,
        },
      }),
    });
    global.fetch = mockFetch;

    const res = await requestUploadSession(validPayload);
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);

    expect(res.ok).toBe(true);
    expect(res.status).toBe("signed_upload_session_created");
    expect(res.uploadSession?.method).toBe("PUT");
    expect(body.file).toBeUndefined();
    expect(body.bytes).toBeUndefined();
    expect(body.base64).toBeUndefined();
    expect(body.objectUrl).toBeUndefined();
    expect(body.videoUrl).toBeUndefined();
  });

  it("trata erro 401 de forma humana e amigável", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
    });

    const res = await requestUploadSession(validPayload);
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Sessão não identificada");
  });

  it("trata erro 403 de forma humana e amigável", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 403,
    });

    const res = await requestUploadSession(validPayload);
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Acesso proibido");
  });

  it("trata erros de validação retornando issues", async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 400,
      json: jest.fn().mockResolvedValue({
        ok: false,
        status: "disabled",
        issues: [{ code: "file_too_large", message: "Arquivo muito grande", severity: "blocker" }],
      }),
    });

    const res = await requestUploadSession(validPayload);
    expect(res.ok).toBe(false);
    expect(res.issues).toHaveLength(1);
    expect(res.issues?.[0].code).toBe("file_too_large");
  });

  it("trata falha de rede como erro humano", async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error("Network Error"));

    const res = await requestUploadSession(validPayload);
    expect(res.ok).toBe(false);
    expect(res.message).toContain("Não foi possível validar o vídeo agora");
  });
});
