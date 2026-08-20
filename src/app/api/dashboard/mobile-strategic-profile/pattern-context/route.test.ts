/** @jest-environment node */
import { GET } from "./route";
import { getServerSession } from "next-auth/next";

import { isCreatorWeeklyProfileExperienceEnabled } from "@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag";
import { loadPatternContext } from "@/app/lib/creatorWeeklyReport/patternContextService";
import { EMPTY_PATTERN_CONTEXT } from "@/app/lib/creatorWeeklyReport/patternContextTypes";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag", () => ({
  isCreatorWeeklyProfileExperienceEnabled: jest.fn(),
}));
jest.mock("@/app/lib/creatorWeeklyReport/patternContextService", () => ({
  loadPatternContext: jest.fn(),
}));
jest.mock("@/app/lib/logger", () => ({ logger: { warn: jest.fn() } }));

const mockGetServerSession = getServerSession as jest.Mock;
const mockFeatureEnabled = isCreatorWeeklyProfileExperienceEnabled as jest.Mock;
const mockLoadPatternContext = loadPatternContext as jest.Mock;
const USER_ID = "507f1f77bcf86cd799439011";

describe("pattern context route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureEnabled.mockReturnValue(true);
    mockGetServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mockLoadPatternContext.mockResolvedValue({ weekKeys: ["2026-W32"], series: {}, territory: null });
  });

  it("não consulta contexto sem uma sessão autenticada", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockLoadPatternContext).not.toHaveBeenCalled();
  });

  it("carrega somente o contexto do usuário autenticado", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockLoadPatternContext).toHaveBeenCalledWith(USER_ID);
    expect(body.context.weekKeys).toEqual(["2026-W32"]);
  });

  it("degrada para contexto vazio quando o enriquecimento falha", async () => {
    mockLoadPatternContext.mockRejectedValue(new Error("database unavailable"));

    const response = await GET();

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ ok: true, context: EMPTY_PATTERN_CONTEXT });
  });

  it("responde 404 sem autenticar enquanto a flag está desligada", async () => {
    mockFeatureEnabled.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });
});
