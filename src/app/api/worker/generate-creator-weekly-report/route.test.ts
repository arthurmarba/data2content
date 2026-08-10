/** @jest-environment node */
import { NextRequest } from "next/server";
import { POST } from "./route";
import { generateCreatorWeeklyReport } from "@/app/lib/creatorWeeklyReport/service";
import { isCreatorWeeklyProfileExperienceEnabled } from "@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag";

jest.mock("@/app/lib/creatorWeeklyReport/service", () => ({
  generateCreatorWeeklyReport: jest.fn(),
}));
jest.mock("@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag", () => ({
  isCreatorWeeklyProfileExperienceEnabled: jest.fn(),
}));

const mockGenerate = generateCreatorWeeklyReport as jest.Mock;
const mockFeatureEnabled = isCreatorWeeklyProfileExperienceEnabled as jest.Mock;
const USER_ID = "507f1f77bcf86cd799439011";

function request(body: object, authorized = true) {
  return new NextRequest("http://localhost/api/worker/generate-creator-weekly-report", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(authorized ? { "x-cron-key": "weekly-report-test-secret" } : {}),
    },
    body: JSON.stringify(body),
  });
}

describe("generate creator weekly report worker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "weekly-report-test-secret";
    mockFeatureEnabled.mockReturnValue(true);
    mockGenerate.mockResolvedValue({ report: { weekKey: "2026-W32", status: "ready" } });
  });

  afterAll(() => {
    delete process.env.CRON_SECRET;
  });

  it("rejects unsigned direct calls", async () => {
    const response = await POST(request({ userId: USER_ID }, false));

    expect(response.status).toBe(401);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("requires the scoped user id", async () => {
    const response = await POST(request({}));

    expect(response.status).toBe(400);
    expect(mockGenerate).not.toHaveBeenCalled();
  });

  it("materializes one report per queued job", async () => {
    const response = await POST(request({ userId: USER_ID }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGenerate).toHaveBeenCalledWith({ userId: USER_ID, force: true });
    expect(body).toEqual({ ok: true, weekKey: "2026-W32", status: "ready" });
  });
});
