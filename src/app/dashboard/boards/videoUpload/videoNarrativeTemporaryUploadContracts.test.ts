import { DEFAULT_TEMPORARY_UPLOAD_POLICY } from "./videoNarrativeTemporaryUploadContracts";

describe("VideoNarrativeTemporaryUploadPolicy Contracts", () => {
  it("default policy vem com provider disabled e storage none", () => {
    expect(DEFAULT_TEMPORARY_UPLOAD_POLICY.providerMode).toBe("disabled");
    expect(DEFAULT_TEMPORARY_UPLOAD_POLICY.storageProvider).toBe("none");
  });

  it("default policy não permite persistir vídeo nem thumbnail", () => {
    expect(DEFAULT_TEMPORARY_UPLOAD_POLICY.allowRawVideoPersistence).toBe(false);
    expect(DEFAULT_TEMPORARY_UPLOAD_POLICY.allowThumbnailPersistence).toBe(false);
  });

  it("default policy exige consentimento explícito do usuário", () => {
    expect(DEFAULT_TEMPORARY_UPLOAD_POLICY.requireExplicitConsent).toBe(true);
  });

  it("default policy tem TTL curto (máximo de 1 hora / 60 minutos)", () => {
    expect(DEFAULT_TEMPORARY_UPLOAD_POLICY.retentionTtlMinutes).toBeLessThanOrEqual(60);
  });

  it("default policy não permite persistência de URL assinada nem acesso público", () => {
    expect(DEFAULT_TEMPORARY_UPLOAD_POLICY.allowSignedUrlPersistence).toBe(false);
    expect(DEFAULT_TEMPORARY_UPLOAD_POLICY.allowPublicAccess).toBe(false);
  });
});
