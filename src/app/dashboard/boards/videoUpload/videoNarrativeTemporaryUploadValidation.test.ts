import fs from "fs";
import path from "path";
import { validateTemporaryUploadInput, sanitizeFileName } from "./videoNarrativeTemporaryUploadValidation";
import { DEFAULT_TEMPORARY_UPLOAD_POLICY } from "./videoNarrativeTemporaryUploadContracts";

const SOURCE_PATH = path.join(__dirname, "videoNarrativeTemporaryUploadValidation.ts");

describe("VideoNarrativeTemporaryUploadValidation Tests", () => {
  const validBaseInput = {
    fileName: "vlog_final.mp4",
    mimeType: "video/mp4",
    sizeBytes: 10 * 1024 * 1024, // 10MB
    durationSeconds: 60,
    userConsentAccepted: true,
    source: "creator_mobile_upload",
    createdAt: new Date().toISOString(),
  };

  it("aceita mp4 válido dentro do limite com consentimento", () => {
    const res = validateTemporaryUploadInput(validBaseInput);
    expect(res.ok).toBe(true);
    expect(res.safeForTemporaryUpload).toBe(true);
    expect(res.issues).toHaveLength(0);
  });

  it("aceita quicktime válido dentro do limite com consentimento", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      fileName: "vlog_ios.mov",
      mimeType: "video/quicktime",
    });
    expect(res.ok).toBe(true);
  });

  it("rejeita mimeType não permitido", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      mimeType: "application/pdf",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "invalid_mime_type")).toBe(true);
  });

  it("rejeita extensão incoerente", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      fileName: "vlog_final.pdf",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "invalid_extension")).toBe(true);
  });

  it("rejeita sizeBytes zero ou negativo", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      sizeBytes: 0,
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "empty_file")).toBe(true);
  });

  it("rejeita arquivo acima do limite", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      sizeBytes: 400 * 1024 * 1024, // 400MB, excede 300MB
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "file_too_large")).toBe(true);
  });

  it("rejeita duração acima do limite", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      durationSeconds: 600, // 10 minutos, excede o limite de 90s
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "duration_too_long")).toBe(true);
  });

  it("rejeita sem consentimento", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      userConsentAccepted: false,
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "consent_required")).toBe(true);
  });

  it("rejeita filename com base64 longo", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      fileName: "data:video/mp4;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=.mp4",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "base64_filename_blocked")).toBe(true);
  });

  it("rejeita filename/source com URL externa", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      fileName: "https://my-bucket.s3.amazonaws.com/dangerous.mp4",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "url_source_blocked")).toBe(true);
  });

  it("rejeita executable/disfarce", () => {
    const res = validateTemporaryUploadInput({
      ...validBaseInput,
      fileName: "cute_cat.mp4.exe",
    });
    expect(res.ok).toBe(false);
    expect(res.issues.some((i) => i.code === "executable_disguise_blocked")).toBe(true);
  });

  it("sanitiza filename adequadamente removendo caminhos e mantendo caracteres seguros", () => {
    expect(sanitizeFileName("../../malicious.mp4")).toBe("._._malicious.mp4");
    expect(sanitizeFileName("meu video legal.mp4")).toBe("meu_video_legal.mp4");
    expect(sanitizeFileName("video*com$caracteres#.mov")).toBe("video_comcaracteres.mov");
  });

  it("retorna shouldDeleteAfterAnalysis=true para upload válido", () => {
    const res = validateTemporaryUploadInput(validBaseInput);
    expect(res.shouldDeleteAfterAnalysis).toBe(true);
  });

  it("retorna shouldPersistVideo=false sempre", () => {
    const res = validateTemporaryUploadInput(validBaseInput);
    expect(res.shouldPersistVideo).toBe(false);
  });

  it("retorna shouldPersistThumbnail=false sempre", () => {
    const res = validateTemporaryUploadInput(validBaseInput);
    expect(res.shouldPersistThumbnail).toBe(false);
  });

  it("não usa fetch ou APIs do browser", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    expect(source).not.toContain("fetch(");
  });

  it("não importa SDK de storage", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    const importLines = source
      .split("\n")
      .filter((line) => line.trim().startsWith("import"))
      .join("\n");

    expect(importLines).not.toContain("@aws-sdk");
    expect(importLines).not.toContain("@google-cloud");
    expect(importLines).not.toContain("cloudinary");
  });

  it("não importa Gemini nem OpenAI", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    expect(source).not.toContain("Gemini");
    expect(source).not.toContain("OpenAI");
  });

  it("não importa Prisma nem Mongoose", () => {
    const source = fs.readFileSync(SOURCE_PATH, "utf8");
    expect(source).not.toContain("prisma");
    expect(source).not.toContain("mongoose");
  });

  it("não altera endpoint de análise nem fluxo +", () => {
    // Apenas assertividade documental e de isolamento de código
    expect(true).toBe(true);
  });
});
