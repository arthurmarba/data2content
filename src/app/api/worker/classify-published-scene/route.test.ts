/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { claimGeminiAvailability, finishReading, geminiUnavailable } from "@/app/lib/relatorio/contentReadingState";
import { freshPublishedMedia } from "@/app/lib/relatorio/publishedMedia";
import { evaluateImagesAgainstMap, evaluateSceneAgainstMap } from "@/app/lib/relatorio/sceneEvaluation";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));
jest.mock("@/app/lib/relatorio/contentReadingState", () => ({
  acquireReading: jest.fn(async () => ({ token: "posse", result: null })),
  checkpointReading: jest.fn(), finishReading: jest.fn(), markGeminiHealthy: jest.fn(),
  claimGeminiAvailability: jest.fn(), geminiUnavailable: jest.fn(),
}));
jest.mock("@/app/lib/relatorio/publishedMedia", () => ({ freshPublishedMedia: jest.fn() }));
jest.mock("@/app/lib/relatorio/sceneEvaluation", () => ({
  SCENE_EVALUATION_VERSION: "cena_mapa_v4", evaluateSceneAgainstMap: jest.fn(), evaluateImagesAgainstMap: jest.fn(),
}));
jest.mock("@/app/lib/relatorio/mapProfiles", () => ({ loadMapProfiles: jest.fn(async () => new Map()) }));
jest.mock("@/app/lib/scripts/publishedContentEvidence", () => ({ upsertPublishedContentEvidence: jest.fn() }));
jest.mock("@/app/lib/relatorio/persistPublishedReading", () => ({ persistPublishedReading: jest.fn() }));
jest.mock("@/app/models/PublishedContentEvidence", () => ({ __esModule: true, default: { exists: jest.fn(async () => null) } }));
const metric = { _id: "69e8f96564be9f1592a5ca6e", user: "69e8f96564be9f1592a5ca6f", instagramMediaId: "ig", type: "REEL", stats: {} };
jest.mock("@/app/models/Metric", () => ({ __esModule: true, default: {
  findById: () => ({ select: () => ({ exec: async () => metric, lean: async () => metric }) }),
} }));
jest.mock("@/app/models/User", () => ({ __esModule: true, default: {
  findById: () => ({ select: () => ({ lean: async () => ({ instagramAccessToken: "token" }) }) }),
} }));

const unavailable = geminiUnavailable as jest.Mock;
const claim = claimGeminiAvailability as jest.Mock;
const media = freshPublishedMedia as jest.Mock;
const request = () => new NextRequest("http://localhost/api/worker/classify-published-scene", {
  method: "POST", headers: { authorization: "Bearer segredo" }, body: JSON.stringify({ metricId: metric._id }),
});

beforeEach(() => {
  jest.clearAllMocks();
  process.env.CRON_SECRET = "segredo";
  unavailable.mockResolvedValue(false);
  claim.mockResolvedValue(true);
  media.mockResolvedValue({ mediaType: "VIDEO", mediaUrl: "https://cdn/v.mp4", imageUrls: [], items: [] });
  (evaluateSceneAgainstMap as jest.Mock).mockResolvedValue({ ok: false, reason: "gemini_provider_balance: Provedor sem saldo; aguardar recuperação.", retryable: false });
});
afterAll(() => { delete process.env.CRON_SECRET; });

it("durante a pausa não busca mídia nem disputa a sonda", async () => {
  unavailable.mockResolvedValue(true);
  const response = await POST(request());
  expect((await response.json()).message).toContain("temporariamente pausado");
  expect(media).not.toHaveBeenCalled();
  expect(claim).not.toHaveBeenCalled();
  expect(finishReading).toHaveBeenCalledWith(metric._id, "posse", expect.stringContaining("temporariamente pausado"));
});

it("post sem mídia compatível não fica com a sonda", async () => {
  media.mockResolvedValue({ mediaType: "VIDEO", mediaUrl: null, imageUrls: [], items: [] });
  await POST(request());
  expect(claim).not.toHaveBeenCalled();
  expect(evaluateSceneAgainstMap).not.toHaveBeenCalled();
  expect(finishReading).toHaveBeenCalledWith(metric._id, "posse", "Post sem mídia compatível para leitura visual.");
});

it("a sonda é tomada logo antes da leitura e a falta de saldo chega a finishReading", async () => {
  await POST(request());
  const [sonda] = claim.mock.invocationCallOrder;
  expect(sonda).toBeGreaterThan(media.mock.invocationCallOrder[0]!);
  expect(sonda).toBeLessThan((evaluateSceneAgainstMap as jest.Mock).mock.invocationCallOrder[0]!);
  expect(finishReading).toHaveBeenCalledWith(metric._id, "posse", expect.stringContaining("gemini_provider_balance"));
});

it("sonda de outro job adia sem chamar o Gemini", async () => {
  claim.mockResolvedValue(false);
  media.mockResolvedValue({ mediaType: "CAROUSEL_ALBUM", mediaUrl: null, imageUrls: ["https://cdn/1.jpg"], items: [{ type: "IMAGE", url: "https://cdn/1.jpg" }] });
  const response = await POST(request());
  expect((await response.json()).message).toContain("temporariamente pausado");
  expect(evaluateImagesAgainstMap).not.toHaveBeenCalled();
});
