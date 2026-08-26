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
const request = (candidateId: string) => ({
  json: jest.fn().mockResolvedValue({ candidateId }),
}) as unknown as Request;
const context = { params: { id: "diag-abc" } };
const recommendation = {
  version: "v1",
  primary: {
    id: "primary",
    spokenLine: "Você sente mais a lombar aqui?",
    onScreenText: null,
    firstFrameDirection: null,
    deliveryDirection: null,
    strategy: "creator_first",
    pattern: "question",
    whyForThisVideo: "A demonstração responde à pergunta.",
  },
  alternatives: [],
  basis: { creatorPosts: 8, territoryPosts: 0, territoryCreators: 0, windowDays: 90, confidence: "medium" },
};

describe("PATCH /diagnosis/[id]/hook-selection", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: userId } });
    mockLean.mockResolvedValue({ hookRecommendation: recommendation });
  });

  it("persiste somente uma opção existente na recomendação salva", async () => {
    const response = await PATCH(request("primary"), context);
    expect(response.status).toBe(200);
    expect(mockUpdateOne).toHaveBeenCalledWith(
      expect.objectContaining({ diagnosisId: "diag-abc" }),
      { $set: { hookSelection: expect.objectContaining({
        candidateId: "primary",
        candidate: expect.objectContaining({ spokenLine: "Você sente mais a lombar aqui?" }),
        selectedAt: expect.any(Date),
      }) } },
    );
  });

  it("rejeita um candidateId injetado pelo cliente", async () => {
    const response = await PATCH(request("inventado"), context);
    expect(response.status).toBe(409);
    expect(mockUpdateOne).not.toHaveBeenCalled();
  });

  it("não permite selecionar em análise de outro usuário", async () => {
    mockLean.mockResolvedValue(null);
    const response = await PATCH(request("primary"), context);
    expect(response.status).toBe(404);
    expect(mockFindOne).toHaveBeenCalledWith(expect.objectContaining({ diagnosisId: "diag-abc" }));
  });
});
