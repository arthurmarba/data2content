import { getServerSession } from "next-auth/next";
import CreatorVideoNarrativeDiagnosis from "@/app/models/CreatorVideoNarrativeDiagnosis";
import {
  readContentAnalysisThumbnail,
  storeContentAnalysisThumbnail,
} from "@/app/dashboard/boards/videoUpload/contentAnalysisThumbnailStorage";
import { GET, POST } from "./route";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({ resolveAuthOptions: jest.fn().mockResolvedValue({}) }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/app/models/CreatorVideoNarrativeDiagnosis", () => ({
  __esModule: true,
  default: { exists: jest.fn(), updateOne: jest.fn() },
}));
jest.mock("@/app/dashboard/boards/videoUpload/contentAnalysisThumbnailStorage", () => ({
  CONTENT_ANALYSIS_THUMBNAIL_MAX_BYTES: 120 * 1024,
  readContentAnalysisThumbnail: jest.fn(),
  storeContentAnalysisThumbnail: jest.fn(),
}));

const context = { params: Promise.resolve({ id: "diag-1" }) };
const model = CreatorVideoNarrativeDiagnosis as unknown as {
  exists: jest.Mock;
  updateOne: jest.Mock;
};

describe("content analysis private thumbnail route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "507f1f77bcf86cd799439011" } });
    model.exists.mockResolvedValue({ _id: "owned" });
    model.updateOne.mockResolvedValue({ acknowledged: true });
    (storeContentAnalysisThumbnail as jest.Mock).mockResolvedValue(true);
  });

  it("recusa acesso sem sessão", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/thumbnail"), context);
    expect(response.status).toBe(401);
  });

  it("não revela thumbnail de outra conta", async () => {
    model.exists.mockResolvedValue(null);
    const response = await GET(new Request("http://localhost/thumbnail"), context);
    expect(response.status).toBe(404);
    expect(readContentAnalysisThumbnail).not.toHaveBeenCalled();
  });

  it("salva somente os bytes derivados e atualiza o status", async () => {
    const bytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
    const response = await POST(new Request("http://localhost/thumbnail", {
      method: "POST",
      headers: { "Content-Type": "image/jpeg" },
      body: bytes,
    }), context);
    expect(response.status).toBe(200);
    expect(storeContentAnalysisThumbnail).toHaveBeenCalledWith(expect.objectContaining({
      userId: "507f1f77bcf86cd799439011",
      diagnosisId: "diag-1",
      contentType: "image/jpeg",
      bytes: expect.any(Uint8Array),
    }));
    expect(model.updateOne).toHaveBeenCalledWith(
      expect.objectContaining({ diagnosisId: "diag-1" }),
      { $set: { thumbnailStatus: "available" } },
    );
  });

  it("serve a capa com cache privado após validar o dono", async () => {
    (readContentAnalysisThumbnail as jest.Mock).mockResolvedValue({
      bytes: new Uint8Array([1, 2, 3]),
      contentType: "image/jpeg",
    });
    const response = await GET(new Request("http://localhost/thumbnail"), context);
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("private");
    expect(response.headers.get("content-type")).toBe("image/jpeg");
  });
});
