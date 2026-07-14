import { PATCH } from "./route";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({ resolveAuthOptions: jest.fn().mockResolvedValue({}) }));
jest.mock("@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag", () => ({
  isMobileStrategicProfileEnabled: jest.fn().mockReturnValue(true),
}));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(undefined) }));

const mockFindOneAndUpdate = jest.fn();
jest.mock("@/app/models/CreatorVideoNarrativeDiagnosis", () => ({
  __esModule: true,
  default: { findOneAndUpdate: (...args: unknown[]) => mockFindOneAndUpdate(...args) },
}));

const { getServerSession } = require("next-auth/next");
const userId = "665f0f2c8a0b7d1f2c3a4b5c";
const request = (body: object) => ({ json: jest.fn().mockResolvedValue(body) }) as unknown as Request;
const context = { params: { id: "diag-abc" } };

describe("PATCH /diagnosis/[id]/content-potential-feedback", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getServerSession as jest.Mock).mockResolvedValue({ user: { id: userId } });
    mockFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve({ diagnosisId: "diag-abc" }) });
  });

  it("rejeita valores fora do vocabulário estruturado", async () => {
    const response = await PATCH(request({ target: "overall", value: "texto livre" }), context);
    expect(response.status).toBe(400);
    expect(mockFindOneAndUpdate).not.toHaveBeenCalled();
  });

  it("persiste evidência contestada e limita o histórico a 20 itens", async () => {
    const response = await PATCH(
      request({ target: "evidence", value: "not_in_video", moment: "opening" }),
      context,
    );

    expect(response.status).toBe(200);
    expect(mockFindOneAndUpdate).toHaveBeenCalledWith(
      expect.objectContaining({ diagnosisId: "diag-abc" }),
      {
        $push: {
          contentPotentialFeedback: {
            $each: [expect.objectContaining({
              target: "evidence",
              value: "not_in_video",
              moment: "opening",
              createdAt: expect.any(Date),
            })],
            $slice: -20,
          },
        },
      },
      { new: true },
    );
  });

  it("não permite gravar em diagnóstico de outro usuário", async () => {
    mockFindOneAndUpdate.mockReturnValue({ lean: () => Promise.resolve(null) });
    const response = await PATCH(request({ target: "overall", value: "helpful" }), context);
    expect(response.status).toBe(404);
  });
});
