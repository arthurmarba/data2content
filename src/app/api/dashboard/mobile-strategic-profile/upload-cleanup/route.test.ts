/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";
import { POST, GET, PUT, PATCH, DELETE } from "./route";
import { isMobileStrategicProfileEnabled } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag";
import {
  isRealUploadEnabled,
  isTemporaryUploadSessionEnabled,
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

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const ROUTE_SOURCE_PATH = path.join(__dirname, "route.ts");
const originalEnv = process.env;

function createRequest(body: any) {
  return new NextRequest("http://localhost/api/dashboard/mobile-strategic-profile/upload-cleanup", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("GET / PUT / PATCH / DELETE /api/dashboard/mobile-strategic-profile/upload-cleanup", () => {
  it("retorna method not allowed para métodos não suportados", async () => {
    expect((await GET()).status).toBe(405);
    expect((await PUT()).status).toBe(405);
    expect((await PATCH()).status).toBe(405);
    expect((await DELETE()).status).toBe(405);
  });
});

describe("POST /api/dashboard/mobile-strategic-profile/upload-cleanup", () => {
  const validPayload = {
    uploadSessionId: "video-temp-upload-session-abc_123",
    objectKey: "temporary/video-narrative/0123456789abcdef/video-temp-upload-session-abc_123.mp4",
    reason: "analysis_completed",
  };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED: "1",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_EMAILS: "",
      VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWED_USER_IDS: "",
    };
    jest.clearAllMocks();
    (isMobileStrategicProfileEnabled as jest.Mock).mockReturnValue(true);
    (isTemporaryUploadSessionEnabled as jest.Mock).mockReturnValue(true);
    (isRealUploadEnabled as jest.Mock).mockReturnValue(false);
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "usr_123", role: "creator" } });
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("bloqueia anônimo", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);

    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(401);
  });

  it("bloqueia feature flag desligada", async () => {
    (isTemporaryUploadSessionEnabled as jest.Mock).mockReturnValue(false);

    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(403);
  });

  it("bloqueia payload com uploadUrl/signedUrl", async () => {
    for (const forbidden of ["uploadUrl", "signedUrl"]) {
      const res = await POST(createRequest({ ...validPayload, [forbidden]: "https://signed.example.test/upload" }));
      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.status).toBe("cleanup_rejected");
    }
  });

  it("aceita uploadSessionId/objectKey seguro em modo contract-first", async () => {
    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(["cleanup_queued", "cleanup_not_configured"]).toContain(body.status);
  });

  it("não retorna secrets nem URL assinada", async () => {
    const res = await POST(createRequest(validPayload));
    const body = await res.json();
    const serialized = JSON.stringify(body);

    expect(serialized).not.toContain("signed.example.test");
    expect(serialized).not.toContain("secret");
    expect(serialized).not.toContain("temporary-video");
  });

  it("exige allowlist/admin-dev quando cleanup real estiver ativo", async () => {
    (isRealUploadEnabled as jest.Mock).mockReturnValue(true);
    process.env.VIDEO_NARRATIVE_SIGNED_UPLOAD_ALLOWLIST_ENABLED = "1";
    (getServerSession as jest.Mock).mockResolvedValue({
      user: { id: "usr_common", email: "common@example.com", role: "creator" },
    });

    const res = await POST(createRequest(validPayload));
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.status).toBe("cleanup_rejected");
    expect(JSON.stringify(body)).not.toContain("common@example.com");
  });

  it("não salva nada em banco nem importa SDK storage", () => {
    const source = fs.readFileSync(ROUTE_SOURCE_PATH, "utf8");

    for (const forbidden of ["upsert", "mongoose", "Prisma", "aws-sdk", "@aws-sdk", "@google-cloud/storage", "cloudinary"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});
