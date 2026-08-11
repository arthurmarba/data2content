import { contentAnalysisThumbnailObjectKey } from "./contentAnalysisThumbnailStorage";

describe("contentAnalysisThumbnailStorage", () => {
  it("gera chave privada determinística sem expor o id do usuário", () => {
    const userId = "507f1f77bcf86cd799439011";
    const key = contentAnalysisThumbnailObjectKey(userId, "diag-safe_1");
    expect(key).toMatch(/^persistent\/content-analysis-thumbnails\/[a-f0-9]{24}\/diag-safe_1\.jpg$/);
    expect(key).not.toContain(userId);
  });
});
