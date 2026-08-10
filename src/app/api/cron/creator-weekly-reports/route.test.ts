/** @jest-environment node */
import { NextRequest } from "next/server";

const publishJSON = jest.fn();
const verify = jest.fn();

jest.mock("@upstash/qstash", () => ({
  Client: jest.fn(() => ({ publishJSON })),
  Receiver: jest.fn(() => ({ verify })),
}));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ find: jest.fn() }));
jest.mock("@/app/lib/creatorWeeklyReport/service", () => ({
  generateCreatorWeeklyReport: jest.fn(),
}));
jest.mock("@/app/dashboard/boards/videoUpload/creatorWeeklyProfileFeatureFlag", () => ({
  isCreatorWeeklyProfileExperienceEnabled: jest.fn(() => true),
}));

process.env.QSTASH_TOKEN = "qstash-test-token";
process.env.QSTASH_CURRENT_SIGNING_KEY = "current-test-key";
process.env.QSTASH_NEXT_SIGNING_KEY = "next-test-key";
process.env.CRON_SECRET = "creator-weekly-test-secret";
process.env.APP_BASE_URL = "https://data2content.ai";

const User = require("@/app/models/User");
const { POST } = require("./route");

function request(authorized = true) {
  return new NextRequest("https://data2content.ai/api/cron/creator-weekly-reports", {
    method: "POST",
    headers: authorized ? { "x-cron-key": "creator-weekly-test-secret" } : {},
    body: "[CREATOR_WEEKLY_REPORT] test",
  });
}

describe("creator weekly reports cron", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    publishJSON.mockResolvedValue({ messageId: "msg_test" });
    verify.mockResolvedValue(false);
    User.find.mockReturnValue({
      select: jest.fn(() => ({
        lean: jest.fn().mockResolvedValue([
          { _id: { toString: () => "507f1f77bcf86cd799439011" } },
          { _id: { toString: () => "507f1f77bcf86cd799439012" } },
        ]),
      })),
    });
  });

  afterAll(() => {
    delete process.env.QSTASH_TOKEN;
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
    delete process.env.CRON_SECRET;
    delete process.env.APP_BASE_URL;
  });

  it("rejects unsigned direct calls", async () => {
    const response = await POST(request(false));

    expect(response.status).toBe(401);
    expect(publishJSON).not.toHaveBeenCalled();
  });

  it("fans out one signed worker job for every eligible creator", async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(User.find).toHaveBeenCalledWith({
      isInstagramConnected: true,
      planStatus: { $in: ["active", "non_renewing"] },
    });
    expect(publishJSON).toHaveBeenNthCalledWith(1, {
      url: "https://data2content.ai/api/worker/generate-creator-weekly-report",
      body: { userId: "507f1f77bcf86cd799439011" },
      retries: 2,
    });
    expect(publishJSON).toHaveBeenNthCalledWith(2, {
      url: "https://data2content.ai/api/worker/generate-creator-weekly-report",
      body: { userId: "507f1f77bcf86cd799439012" },
      retries: 2,
    });
    expect(body).toEqual({
      ok: true,
      mode: "queue",
      eligible: 2,
      queued: 2,
      failed: 0,
    });
  });
});
