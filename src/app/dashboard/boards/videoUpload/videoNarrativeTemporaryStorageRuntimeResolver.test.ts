import { resolveVideoNarrativeTemporaryStorageObject } from "./videoNarrativeTemporaryStorageRuntimeResolver";

describe("videoNarrativeTemporaryStorageRuntimeResolver", () => {
  it("20. Retorna missing_storage_adapter quando não há adapter", () => {
    const result = resolveVideoNarrativeTemporaryStorageObject({
      uploadSessionId: "fake-id",
      objectKey: "fake-key.mp4",
      mimeType: "video/mp4",
    });

    expect(result.ok).toBe(false);
    expect(result.status).toBe("missing_storage_adapter");
    expect(result.safeMessage).toBe("A análise real ainda precisa da conexão temporária de storage para ler o vídeo.");
    expect(result.issues).toContainEqual(
      expect.objectContaining({ code: "storage_sdk_not_implemented" })
    );
  });

  it("22. Não retorna signed URL", () => {
    const result = resolveVideoNarrativeTemporaryStorageObject({
      objectKey: "secret-key",
    });

    const stringified = JSON.stringify(result);
    expect(stringified).not.toContain("https://");
    expect(stringified).not.toContain("signedUrl");
  });

  it("23. Não persiste objectKey", () => {
    const result = resolveVideoNarrativeTemporaryStorageObject({
      objectKey: "secret-key",
    });

    expect(JSON.stringify(result)).not.toContain("secret-key");
  });

  it("24. Não expõe secret", () => {
    const result = resolveVideoNarrativeTemporaryStorageObject({
      objectKey: "aws_secret_fake",
    });

    expect(JSON.stringify(result)).not.toContain("aws_secret_fake");
  });
});
