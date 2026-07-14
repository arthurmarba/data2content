import { PATCH } from "./route";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn().mockResolvedValue({}),
}));

jest.mock("@/app/dashboard/boards/videoUpload/mobileStrategicProfileFeatureFlag", () => ({
  isMobileStrategicProfileEnabled: jest.fn().mockReturnValue(true),
}));

const mockUpdateContentIdeaStatus = jest.fn();
const mockScheduleContentIdea = jest.fn();
jest.mock("@/app/dashboard/boards/videoUpload/contentIdeasReadService", () => ({
  updateContentIdeaStatus: (...args: unknown[]) => mockUpdateContentIdeaStatus(...args),
  scheduleContentIdea: (...args: unknown[]) => mockScheduleContentIdea(...args),
}));

const { getServerSession } = require("next-auth/next");

function authenticatedSession(userId = "665f0f2c8a0b7d1f2c3a4b5c") {
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: userId } });
}

function makeRequest(body: object) {
  return {
    json: jest.fn().mockResolvedValue(body),
  } as unknown as Request;
}

function makeParams(id = "665f0f2c8a0b7d1f2c3a4b5d") {
  return { params: { id } };
}

describe("PATCH /content-ideas/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUpdateContentIdeaStatus.mockResolvedValue({ ok: true });
    mockScheduleContentIdea.mockResolvedValue({ ok: true });
  });

  it("retorna 404 quando a pauta não existe", async () => {
    authenticatedSession();
    mockUpdateContentIdeaStatus.mockResolvedValueOnce({ ok: false, error: "not_found" });

    const res = await PATCH(makeRequest({ status: "saved" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.message).toBe("Pauta não encontrada.");
  });

  it("retorna 503 storage_unavailable quando o banco bloqueia write", async () => {
    authenticatedSession();
    mockUpdateContentIdeaStatus.mockResolvedValueOnce({ ok: false, error: "storage_unavailable" });

    const res = await PATCH(makeRequest({ status: "saved" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body.reason).toBe("storage_unavailable");
  });

  it("retorna mensagem específica ao falhar remoção por storage_unavailable", async () => {
    authenticatedSession();
    mockUpdateContentIdeaStatus.mockResolvedValueOnce({ ok: false, error: "storage_unavailable" });

    const res = await PATCH(makeRequest({ status: "active" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(503);
    expect(body).toEqual({
      message: "Não foi possível remover a pauta agora.",
      reason: "storage_unavailable",
    });
  });

  it("retorna 200 quando muda status", async () => {
    authenticatedSession();

    const res = await PATCH(makeRequest({ status: "dismissed" }), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true });
    expect(mockUpdateContentIdeaStatus).toHaveBeenCalledWith(
      "665f0f2c8a0b7d1f2c3a4b5c",
      "665f0f2c8a0b7d1f2c3a4b5d",
      "dismissed",
    );
  });
});
