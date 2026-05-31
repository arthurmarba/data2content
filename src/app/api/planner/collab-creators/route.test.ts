/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";
import { POST } from "./route";
import { ensurePlannerAccess } from "@/app/lib/planGuard";
import { buildCollabCreatorSuggestions } from "@/app/lib/planner/collabCreatorSuggestionsService";

jest.mock("next-auth/next", () => ({
  getServerSession: jest.fn(),
}));

jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn(() => Promise.resolve({})),
}));

jest.mock("@/app/lib/planGuard", () => ({
  ensurePlannerAccess: jest.fn(),
}));

jest.mock("@/app/lib/planner/collabCreatorSuggestionsService", () => ({
  buildCollabCreatorSuggestions: jest.fn(),
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const mockEnsurePlannerAccess = ensurePlannerAccess as jest.Mock;
const mockBuildCollabCreatorSuggestions = buildCollabCreatorSuggestions as jest.Mock;

function createRequest(body: any) {
  return new NextRequest("http://localhost/api/planner/collab-creators", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/planner/collab-creators", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getServerSession.mockResolvedValue({ user: { id: "user-1", planStatus: "active" } });
    mockEnsurePlannerAccess.mockResolvedValue({ ok: true, normalizedStatus: "active", source: "database" });
    mockBuildCollabCreatorSuggestions.mockResolvedValue({
      items: [{ id: "creator-1", name: "Creator One", rank: 1 }],
      contextLabel: "Beleza",
    });
  });

  it("keeps the existing response contract while delegating to shared service", async () => {
    const body = {
      categories: { context: ["beauty"], proposal: ["tutorial"] },
      themeKeyword: "rotina",
      title: "Rotina de skincare",
      periodDays: 120,
      limit: 2,
    };

    const res = await POST(createRequest(body));
    const payload = await res.json();

    expect(res.status).toBe(200);
    expect(payload).toEqual({
      ok: true,
      items: [{ id: "creator-1", name: "Creator One", rank: 1 }],
      contextLabel: "Beleza",
    });
    expect(mockBuildCollabCreatorSuggestions).toHaveBeenCalledWith({
      viewerId: "user-1",
      categories: body.categories,
      themeKeyword: "rotina",
      title: "Rotina de skincare",
      periodDays: 120,
      limit: 2,
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    getServerSession.mockResolvedValue(null);

    const res = await POST(createRequest({}));
    const payload = await res.json();

    expect(res.status).toBe(401);
    expect(payload).toEqual({ ok: false, error: "Unauthorized" });
    expect(mockBuildCollabCreatorSuggestions).not.toHaveBeenCalled();
  });
});
