/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";
import { POST, resolveMobileCollabThemeKeyword } from "./route";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import { buildCollabCreatorSuggestions } from "@/app/lib/planner/collabCreatorSuggestionsService";
import UserModel from "@/app/models/User";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock("@/app/lib/planGuard", () => ({
  ensurePlannerAccess: jest.fn(),
}));

jest.mock("@/app/lib/planner/collabCreatorSuggestionsService", () => ({
  buildCollabCreatorSuggestions: jest.fn(),
}));

jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
  },
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const mockEnsurePlannerAccess = ensurePlannerAccess as jest.Mock;
const mockBuildCollabCreatorSuggestions = buildCollabCreatorSuggestions as jest.Mock;
const mockFindById = UserModel.findById as jest.Mock;
const USER_ID = "507f1f77bcf86cd799439011";

function mockUserLookup(user: any) {
  const lean = jest.fn().mockResolvedValue(user);
  const select = jest.fn().mockReturnValue({ lean });
  mockFindById.mockReturnValue({ select });
}

function createRequest(body: any) {
  return new NextRequest("http://localhost/api/dashboard/mobile-strategic-profile/collabs/suggestions", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/dashboard/mobile-strategic-profile/collabs/suggestions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({
      user: { id: USER_ID, planStatus: "active", instagramConnected: true },
    });
    mockEnsurePlannerAccess.mockResolvedValue({ ok: true, normalizedStatus: "active", source: "database" });
    mockUserLookup({ isInstagramConnected: true });
    mockBuildCollabCreatorSuggestions.mockResolvedValue({
      items: [
        { id: "creator-1", name: "Creator One", rank: 1 },
        { id: "creator-2", name: "Creator Two", rank: 2 },
        { id: "creator-3", name: "Creator Three", rank: 3 },
      ],
      contextLabel: null,
    });
  });

  it("blocks personalized collabs when Instagram is not connected", async () => {
    getServerSession.mockResolvedValue({
      user: { id: USER_ID, planStatus: "active", instagramConnected: false },
    });
    mockUserLookup({ isInstagramConnected: false });

    const res = await POST(createRequest({ narrativeLabel: "Humor cotidiano" }));
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.reason).toBe("instagram_required");
    expect(mockBuildCollabCreatorSuggestions).not.toHaveBeenCalled();
  });

  it("limits to three and falls back from collab territories when narrative is missing", async () => {
    const res = await POST(createRequest({
      narrativeLabel: "",
      collabTerritories: [{ label: "Rotina real compartilhada" }],
      commercialTerritories: [{ label: "Beleza acessivel" }],
      periodDays: 10,
      limit: 10,
    }));
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload.themeKeyword).toBe("Rotina real compartilhada");
    expect(mockBuildCollabCreatorSuggestions).toHaveBeenCalledWith({
      viewerId: USER_ID,
      themeKeyword: "Rotina real compartilhada",
      periodDays: 30,
      limit: 3,
    });
  });

  it("uses narrative label before collab and commercial territories", () => {
    expect(resolveMobileCollabThemeKeyword({
      narrativeLabel: "Humor com identificacao",
      collabTerritories: [{ label: "Rotina real" }],
      commercialTerritories: [{ label: "Beleza" }],
    })).toBe("Humor com identificacao");
  });

  it("blocks inactive non-admin users", async () => {
    mockEnsurePlannerAccess.mockResolvedValue({ ok: true, normalizedStatus: null, source: "database" });

    const res = await POST(createRequest({ narrativeLabel: "Humor cotidiano" }));
    const payload = await res.json();

    expect(res.status).toBe(403);
    expect(payload.reason).toBe("inactive");
    expect(mockBuildCollabCreatorSuggestions).not.toHaveBeenCalled();
  });
});
