import { PATCH } from "./route";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({ resolveAuthOptions: jest.fn().mockResolvedValue({}) }));
jest.mock("@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag", () => ({
  isMobileStrategicProfileEnabled: jest.fn().mockReturnValue(true),
}));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(undefined) }));

const mockLean = jest.fn();
const mockFindOne = jest.fn(() => ({ select: () => ({ lean: mockLean }) }));
const mockUpdateOne = jest.fn().mockResolvedValue({ modifiedCount: 1 });
jest.mock("@/app/models/CreatorVideoNarrativeDiagnosis", () => ({
  __esModule: true,
  default: {
    findOne: mockFindOne,
    updateOne: mockUpdateOne,
  },
}));

const { getServerSession } = require("next-auth/next");
const userId = "665f0f2c8a0b7d1f2c3a4b5c";
const request = (selectedStepIds: string[]) => ({ json: jest.fn().mockResolvedValue({ selectedStepIds }) }) as unknown as Request;
const context = { params: Promise.resolve({ id: "diag-abc" }) };
const recommendation = {
  version: "script-adjustment-v1",
  pattern: "direct_explanation",
  summary: "Encurte a introdução.",
  effort: "no_rerecord",
  canUseExistingFootage: true,
  currentStructure: [],
  recommendedStructure: [],
  steps: [{
    id: "shorten-intro", action: "shorten", sourceStartMs: 0, sourceEndMs: 4000,
    targetStartMs: 0, targetEndMs: 2000, targetOrder: 1, title: "Encurte a introdução",
    instruction: "Corte a primeira frase repetida.", suggestedCopy: null,
    reason: "A ideia começa depois dessa frase.", confidence: "high",
  }],
  rationale: "A mudança preserva o restante do vídeo.",
  basis: { video: true, creatorPosts: 0, territoryPosts: 0, territoryCreators: 0, confidence: "low" },
};

describe("PATCH /diagnosis/[id]/script-adjustment-selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: userId } });
    mockLean.mockResolvedValue({ scriptAdjustmentRecommendation: recommendation, videoMetadata: { durationSeconds: 20 } });
  });

  it("persiste apenas passos da recomendação salva", async () => {
    const response = await PATCH(request(["shorten-intro"]), context);
    expect(response.status).toBe(200);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ diagnosisId: "diag-abc" }),
      { $set: { scriptAdjustmentSelection: expect.objectContaining({
        selectedStepIds: ["shorten-intro"],
        recommendationVersion: "script-adjustment-v1",
        selectedAt: expect.any(Date),
      }) } },
    );
  });

  it("rejeita passo inventado pelo cliente", async () => {
    const response = await PATCH(request(["inventado"]), context);
    expect(response.status).toBe(409);
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });
});
