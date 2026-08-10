/** @jest-environment node */
import { NextRequest } from "next/server";
import { GET, POST } from "./route";
import { getServerSession } from "next-auth/next";
import {
  generateCreatorWeeklyReport,
  getOrGenerateCreatorWeeklyReport,
} from "@/app/lib/creatorWeeklyReport/service";
import { isCreatorWeeklyProfileExperienceEnabled } from "@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/app/lib/creatorWeeklyReport/service", () => ({
  generateCreatorWeeklyReport: jest.fn(),
  getOrGenerateCreatorWeeklyReport: jest.fn(),
}));
jest.mock("@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag", () => ({
  isCreatorWeeklyProfileExperienceEnabled: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockGetReport = getOrGenerateCreatorWeeklyReport as jest.Mock;
const mockGenerateReport = generateCreatorWeeklyReport as jest.Mock;
const mockFeatureEnabled = isCreatorWeeklyProfileExperienceEnabled as jest.Mock;
const USER_ID = "507f1f77bcf86cd799439011";

function postRequest(body: object) {
  return new NextRequest("http://localhost/api/dashboard/mobile-strategic-profile/weekly-report", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("creator weekly report route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFeatureEnabled.mockReturnValue(true);
    mockGetServerSession.mockResolvedValue({ user: { id: USER_ID } });
    mockGetReport.mockResolvedValue({ report: { status: "ready", weekKey: "2026-W32" } });
    mockGenerateReport.mockResolvedValue({ report: { status: "partial", weekKey: "2026-W32" } });
  });

  it("never loads another creator and rejects an anonymous request", async () => {
    mockGetServerSession.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(mockGetReport).not.toHaveBeenCalled();
  });

  it("returns only the report for the authenticated session", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetReport).toHaveBeenCalledWith(USER_ID);
    expect(body.report).toEqual({ status: "ready", weekKey: "2026-W32" });
  });

  it("regenerates on demand only when force is explicitly true", async () => {
    const response = await POST(postRequest({ force: true }));

    expect(response.status).toBe(200);
    expect(mockGenerateReport).toHaveBeenCalledWith({ userId: USER_ID, force: true });
  });

  it("returns 404 while the rollout flag is disabled", async () => {
    mockFeatureEnabled.mockReturnValue(false);

    const response = await GET();

    expect(response.status).toBe(404);
    expect(mockGetServerSession).not.toHaveBeenCalled();
  });
});
