/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";
import { POST, GET, PUT, PATCH, DELETE } from "./route";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isTemporaryUploadSessionEnabled,
  isRealUploadEnabled,
} from "@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag";
import fs from "fs";
import path from "path";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag", () => ({
  isMobileStrategicProfileEnabled: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryUploadFeatureFlag", () => ({
  isTemporaryUploadSessionEnabled: jest.fn(),
  isRealUploadEnabled: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/narrativeMapReadingQuotaService", () => ({
  assertCanStartNarrativeMapReading: jest.fn(),
}));

jest.mock("@/app/lib/planGuard", () => ({
  ensurePlannerAccess: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageSignedUrlProvider", () => {
  const actual = jest.requireActual("@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageSignedUrlProvider");
  return {
    ...actual,
    createServerSideSignedUploadUrlSigner: jest.fn(() => null),
  };
});

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const createServerSideSignedUploadUrlSigner =
  require("@/app/dashboard/boards/videoUpload/videoNarrativeTemporaryStorageSignedUrlProvider")
    .createServerSideSignedUploadUrlSigner as jest.Mock;
const assertCanStartNarrativeMapReading =
  require("@/app/dashboard/boards/videoUpload/narrativeMapReadingQuotaService")
    .assertCanStartNarrativeMapReading as jest.Mock;
const ensurePlannerAccess = require("@/app/lib/planGuard").ensurePlannerAccess as jest.Mock;
const ROUTE_SOURCE_PATH = path.join(__dirname, "route.ts");
const originalEnv = process.env;

function createRequest(method: string, body: any) {
  return new NextRequest("http://localhost/api/dashboard/mobile-strategic-profile/upload-session", {
    method,
    body: body ? JSON.stringify(body) : undefined,
    headers: { "content-type": "application/json" },
  });
}

describe("GET / PUT / PATCH / DELETE /api/dashboard/mobile-strategic-profile/upload-session", () => {
  it("GET retorna method not allowed", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });

  it("PUT retorna method not allowed", async () => {
    const res = await PUT();
    expect(res.status).toBe(405);
  });

  it("PATCH retorna method not allowed", async () => {
    const res = await PATCH();
    expect(res.status).toBe(405);
  });

  it("DELETE retorna method not allowed", async () => {
    const res = await DELETE();
    expect(res.status).toBe(405);
  });
});

describe("POST /api/dashboard/mobile-strategic-profile/upload-session", () => {
  const validBasePayload = {
    fileName: "video.mp4",
    mimeType: "video/mp4",
    sizeBytes: 1024 * 1024 * 5, // 5MB
    durationSeconds: 30,
    userConsentAccepted: true,
    consentTextVersion: "v1.0",
    source: "mobile_strategic_profile",
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER: "mock",
      VIDEO_NARRATIVE_TEMP_UPLOAD_SESSION_ENABLED: "1",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS: "",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_USER_IDS: "",
      VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET: "",
      VIDEO_NARRATIVE_TEMP_STORAGE_REGION: "",
      VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT: "",
    };
    jest.clearAllMocks();
    createServerSideSignedUploadUrlSigner.mockReturnValue(null);
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
    (isTemporaryUploadSessionEnabled as jest.Mock).mockReturnValue(true);
    (isRealUploadEnabled as jest.Mock).mockReturnValue(false);
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "usr_123" } });
    ensurePlannerAccess.mockResolvedValue({ ok: true, normalizedStatus: null, source: "database" });
    assertCanStartNarrativeMapReading.mockResolvedValue({
      ok: true,
      state: "free_unused",
      quota: { monthKey: "2026-05", usedTotal: 0, usedThisMonth: 0, freeTotalLimit: 1, proMonthlyLimit: 10 },
      message: "Leitura disponível.",
    });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("POST bloqueia usuário anônimo/deslogado", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(401);
  });

  it("POST bloqueia se mobile strategic profile feature flag estiver desligada", async () => {
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(false);

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(403);
  });

  it("POST bloqueia se temporary upload session feature flag estiver desligada", async () => {
    (isTemporaryUploadSessionEnabled as jest.Mock).mockReturnValue(false);

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(403);
  });

  it("POST bloqueia antes do upload quando quota de leitura está indisponível", async () => {
    assertCanStartNarrativeMapReading.mockResolvedValue({
      ok: false,
      state: "free_preview_used",
      quota: { monthKey: "2026-05", usedTotal: 1, usedThisMonth: 1, freeTotalLimit: 1, proMonthlyLimit: 10 },
      message: "Limite de leituras indisponível.",
    });

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.reason).toBe("reading_quota_unavailable");
    expect(body.accessState).toBe("free_preview_used");
  });

  it("POST bloqueia provider real / storage real se allowlist estiver desligada", async () => {
    (isRealUploadEnabled as jest.Mock).mockReturnValue(true);

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.status).toBe("disabled");
    expect(body.issues.some((issue: any) => issue.code === "signed_upload_allowlist_disabled")).toBe(true);
  });

  it("POST bloqueia usuário não allowlisted quando upload real está ativo", async () => {
    (isRealUploadEnabled as jest.Mock).mockReturnValue(true);
    process.env.VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED = "1";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER = "r2";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET = "temporary-video";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION = "auto";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT = "https://r2.example.test";
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "usr_common", email: "common@example.com", role: "creator" },
    });

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.issues.some((issue: any) => issue.code === "signed_upload_user_not_allowed")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("common@example.com");
  });

  it("POST bloqueia payload inválido antes do provider real", async () => {
    const signer = jest.fn().mockReturnValue({ uploadUrl: "https://signed.example.test/upload?signature=test" });
    createServerSideSignedUploadUrlSigner.mockReturnValue(signer);
    (isRealUploadEnabled as jest.Mock).mockReturnValue(true);
    process.env.VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED = "1";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER = "r2";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET = "temporary-video";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION = "auto";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT = "https://r2.example.test";
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "usr_admin", email: "admin@example.com", role: "admin" },
    });

    const res = await POST(createRequest("POST", { ...validBasePayload, mimeType: "image/png" }));
    expect(res.status).toBe(400);
    expect(signer).not.toHaveBeenCalled();
  });

  it("POST bloqueia payload com 'file' no corpo", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, file: "raw" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("não é permitido nesta rota");
  });

  it("POST bloqueia payload com 'videoUrl'", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, videoUrl: "http://path" }));
    expect(res.status).toBe(400);
  });

  it("POST bloqueia payload com 'thumbnailUrl'", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, thumbnailUrl: "http://path" }));
    expect(res.status).toBe(400);
  });

  it("POST bloqueia payload com 'base64'", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, base64: "data:video/mp4;base64,123..." }));
    expect(res.status).toBe(400);
  });

  it("POST bloqueia payload com 'signedUrl'", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, signedUrl: "http://signed" }));
    expect(res.status).toBe(400);
  });

  it("POST bloqueia payload acima do tamanho permitido (5000 chars)", async () => {
    const longString = "a".repeat(5001);
    const res = await POST(createRequest("POST", { ...validBasePayload, dummy: longString }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.message).toContain("tamanho do payload excedeu o limite máximo seguro");
  });

  it("POST bloqueia mimeType inválido", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, mimeType: "image/png" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.issues.some((i: any) => i.code === "invalid_mime_type")).toBe(true);
  });

  it("POST bloqueia extensão incoerente", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, fileName: "test.zip" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.issues.some((i: any) => i.code === "invalid_extension")).toBe(true);
  });

  it("POST bloqueia sizeBytes zero", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, sizeBytes: 0 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.issues.some((i: any) => i.code === "empty_file")).toBe(true);
  });

  it("POST bloqueia arquivo acima do limite", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, sizeBytes: 150 * 1024 * 1024 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.some((i: any) => i.code === "file_too_large")).toBe(true);
  });

  it("POST bloqueia duração acima do limite", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, durationSeconds: 600 }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.some((i: any) => i.code === "duration_too_long")).toBe(true);
  });

  it("POST bloqueia sem consentimento", async () => {
    const res = await POST(createRequest("POST", { ...validBasePayload, userConsentAccepted: false }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.some((i: any) => i.code === "consent_required")).toBe(true);
  });

  it("POST aceita metadados mp4 válidos em modo mock", async () => {
    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("mock_session_created");
    expect(body.providerMode).toBe("mock");
    expect(body.storageProvider).toBe("none");
  });

  it("POST aceita quicktime válido em modo mock", async () => {
    const res = await POST(createRequest("POST", {
      ...validBasePayload,
      fileName: "video.mov",
      mimeType: "video/quicktime",
    }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("POST retorna mock_session_created sem uploadUrl real", async () => {
    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.uploadSession.uploadUrl).toBeUndefined();
  });

  it("POST retorna shouldPersistVideo=false", async () => {
    const res = await POST(createRequest("POST", validBasePayload));
    const body = await res.json();
    expect(body.uploadSession.shouldPersistVideo).toBe(false);
  });

  it("POST retorna shouldPersistThumbnail=false", async () => {
    const res = await POST(createRequest("POST", validBasePayload));
    const body = await res.json();
    expect(body.uploadSession.shouldPersistThumbnail).toBe(false);
  });

  it("POST retorna shouldDeleteAfterAnalysis=true", async () => {
    const res = await POST(createRequest("POST", validBasePayload));
    const body = await res.json();
    expect(body.uploadSession.shouldDeleteAfterAnalysis).toBe(true);
  });

  it("POST não retorna signedUrl no response", async () => {
    const res = await POST(createRequest("POST", validBasePayload));
    const body = await res.json();
    expect(body.uploadSession.signedUrl).toBeUndefined();
    expect(body.uploadSession.url).toBeUndefined();
  });

  it("POST não retorna bucket ou storageKey real", async () => {
    const res = await POST(createRequest("POST", validBasePayload));
    const body = await res.json();
    expect(body.uploadSession.bucket).toBeUndefined();
    expect(body.uploadSession.storageKey).toBeUndefined();
  });

  it("POST retorna disabled quando provider está disabled", async () => {
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER = "disabled";

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.status).toBe("disabled");
    expect(body.reason).toBe("temporary_storage_disabled");
    expect(body.uploadSession).toBeUndefined();
  });

  it("POST retorna signed_upload_session_created para usuário allowlisted com signer server-side", async () => {
    const signer = jest.fn().mockReturnValue({ uploadUrl: "https://signed.example.test/upload?signature=test" });
    createServerSideSignedUploadUrlSigner.mockReturnValue(signer);
    (isRealUploadEnabled as jest.Mock).mockReturnValue(true);
    process.env.VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED = "1";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER = "r2";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET = "temporary-video";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION = "auto";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT = "https://r2.example.test";
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "usr_allowed", email: "allowed@example.com", role: "creator" },
    });
    process.env.VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS = "allowed@example.com";

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.status).toBe("signed_upload_session_created");
    expect(body.uploadSession.method).toBe("PUT");
    expect(body.uploadSession.headers["Content-Type"]).toBe("video/mp4");
    expect(body.uploadSession.uploadUrl).toContain("https://signed.example.test/upload");
    expect(body.uploadSession.objectKey).toMatch(/^temporary\/video-narrative\/[a-f0-9]{16}\//);
    expect(body.uploadSession.objectKey).not.toContain("video.mp4");
    expect(body.uploadSession.shouldPersistVideo).toBe(false);
    expect(body.uploadSession.shouldPersistThumbnail).toBe(false);
    expect(body.uploadSession.shouldDeleteAfterAnalysis).toBe(true);
    expect(JSON.stringify(body)).not.toContain("temporary-video");
    expect(JSON.stringify(body)).not.toContain("access");
    expect(JSON.stringify(body)).not.toContain("secret");
  });

  it("POST retorna erro seguro se provider real estiver incompleto", async () => {
    createServerSideSignedUploadUrlSigner.mockReturnValue(() => ({ uploadUrl: "https://signed.example.test/upload" }));
    (isRealUploadEnabled as jest.Mock).mockReturnValue(true);
    process.env.VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED = "1";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_PROVIDER = "r2";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_BUCKET = "";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_REGION = "";
    process.env.VIDEO_NARRATIVE_TEMP_STORAGE_ENDPOINT = "";
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "usr_admin", email: "admin@example.com", role: "admin" },
    });

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.issues.some((issue: any) => issue.code === "missing_storage_bucket")).toBe(true);
    expect(JSON.stringify(body)).not.toContain("SECRET");
  });

  it("POST usa a factory de storage temporário", () => {
    const source = fs.readFileSync(ROUTE_SOURCE_PATH, "utf8");

    expect(source).toContain("createVideoNarrativeTemporaryStorageProvider");
    expect(source).toContain("storageFactory.provider.createUploadSession");
  });

  it("POST não salva vídeo/metadados em banco nem importa SDK storage", () => {
    const source = fs.readFileSync(ROUTE_SOURCE_PATH, "utf8");

    for (const forbidden of [
      "upsert",
      "mongoose",
      "Prisma",
      "aws-sdk",
      "@aws-sdk",
      "@google-cloud/storage",
      "cloudinary",
      "uploadUrl: signed",
      "bucketName",
    ]) {
      expect(source).not.toContain(forbidden);
    }
  });

  it("Erro interno retorna mensagem humana sem stack trace", async () => {
    (getServerSession as jest.Mock).mockRejectedValue(new Error("Erro crítico do banco de dados!"));

    const res = await POST(createRequest("POST", validBasePayload));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.message).toContain("Ocorreu um erro interno no servidor");
    expect(body.stack).toBeUndefined();
  });
});
