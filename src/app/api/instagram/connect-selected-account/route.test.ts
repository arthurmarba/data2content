/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { connectInstagramAccount } from "@/app/lib/instagram";
import {
  findPostCreationTrialUsageByInstagram,
  markPostCreationTrialInstagramConnected,
} from "@/app/lib/postCreationTrial/access";
import { recordPostCreationFunnelEvent } from "@/app/lib/postCreationTrial/events";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({
  findById: jest.fn(),
  findByIdAndUpdate: jest.fn(),
  findOne: jest.fn(),
}));
jest.mock("@/app/lib/instagram", () => ({
  connectInstagramAccount: jest.fn(),
}));
jest.mock("@/app/lib/postCreationTrial/access", () => ({
  findPostCreationTrialUsageByInstagram: jest.fn(),
  markPostCreationTrialInstagramConnected: jest.fn(),
}));
jest.mock("@/app/lib/postCreationTrial/events", () => ({
  recordPostCreationFunnelEvent: jest.fn(),
}));
jest.mock("@/app/lib/logger", () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
  },
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnectToDatabase = connectToDatabase as jest.Mock;
const mockFindById = (User as any).findById as jest.Mock;
const mockFindByIdAndUpdate = (User as any).findByIdAndUpdate as jest.Mock;
const mockFindOne = (User as any).findOne as jest.Mock;
const mockConnectInstagramAccount = connectInstagramAccount as jest.Mock;
const mockFindTrialUsage = findPostCreationTrialUsageByInstagram as jest.Mock;
const mockMarkTrialInstagramConnected = markPostCreationTrialInstagramConnected as jest.Mock;
const mockRecordEvent = recordPostCreationFunnelEvent as jest.Mock;
const { POST } = require("./route");

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest(
    "http://localhost/api/instagram/connect-selected-account",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function mockUserLookup(user: any) {
  const lean = jest.fn().mockResolvedValue(user);
  const select = jest.fn().mockReturnValue({ lean });
  mockFindById.mockReturnValue({ select });
  return { select, lean };
}

describe("POST /api/instagram/connect-selected-account", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnectToDatabase.mockResolvedValue(undefined);
    mockFindByIdAndUpdate.mockResolvedValue({});
    mockFindOne.mockReturnValue({
      select: jest
        .fn()
        .mockReturnValue({ lean: jest.fn().mockResolvedValue(null) }),
    });
    mockFindTrialUsage.mockResolvedValue(null);
    mockMarkTrialInstagramConnected.mockResolvedValue(null);
    mockRecordEvent.mockResolvedValue(undefined);
  });

  it("returns 401 when session is invalid", async () => {
    mockGetServerSession.mockResolvedValue(null);
    const res = await POST(makeRequest({ instagramAccountId: "ig_1" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.errorCode).toBe("UNKNOWN");
    expect(body.reconnectFlowId).toBeNull();
  });

  it("returns 400 when selected account does not belong to the user", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
    });
    mockUserLookup({
      instagramAccessToken: "llat-token",
      availableIgAccounts: [{ igAccountId: "ig_valid" }],
    });

    const res = await POST(makeRequest({ instagramAccountId: "ig_invalid" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("INVALID_IG_ACCOUNT_SELECTION");
    expect(body.reconnectFlowId).toMatch(/^igrc_/);
    expect(mockConnectInstagramAccount).not.toHaveBeenCalled();
  });

  it("returns 400 when llat is missing", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
    });
    mockUserLookup({
      instagramAccessToken: null,
      availableIgAccounts: [{ igAccountId: "ig_valid" }],
    });

    const res = await POST(makeRequest({ instagramAccountId: "ig_valid" }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.errorCode).toBe("LINK_TOKEN_INVALID");
    expect(body.reconnectFlowId).toMatch(/^igrc_/);
    expect(mockConnectInstagramAccount).not.toHaveBeenCalled();
  });

  it("returns 409 when selected Instagram account is already linked elsewhere", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
    });
    mockUserLookup({
      instagramAccessToken: "llat-token",
      availableIgAccounts: [{ igAccountId: "ig_valid" }],
    });
    mockFindOne.mockReturnValue({
      select: jest.fn().mockReturnValue({
        lean: jest.fn().mockResolvedValue({ _id: "507f1f77bcf86cd799439022" }),
      }),
    });

    const res = await POST(makeRequest({ instagramAccountId: "ig_valid" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.errorCode).toBe("FACEBOOK_ALREADY_LINKED");
    expect(body.errorMessage).toContain("Instagram");
    expect(mockConnectInstagramAccount).not.toHaveBeenCalled();
  });

  it("returns 409 when selected Instagram account already consumed post creation trial", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
    });
    mockUserLookup({
      instagramAccessToken: "llat-token",
      availableIgAccounts: [{ igAccountId: "ig_valid" }],
    });
    mockFindTrialUsage.mockResolvedValue({
      userId: "507f1f77bcf86cd799439033",
      accountState: "registered",
      trial: {
        startedAt: "2026-04-24T00:00:00.000Z",
        analysisUsedAt: "2026-04-24T00:02:00.000Z",
        pautaUsedAt: null,
        firstDraftId: null,
        instagramAccountId: "ig_valid",
        completedSignupAt: null,
        subscribedAt: null,
        source: "post_creation_board",
      },
    });

    const res = await POST(makeRequest({ instagramAccountId: "ig_valid" }));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.errorCode).toBe("POST_CREATION_TRIAL_ALREADY_USED");
    expect(body.errorMessage).toContain("teste gratuito");
    expect(mockConnectInstagramAccount).not.toHaveBeenCalled();
    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "post_creation_trial_already_used",
        userId: "507f1f77bcf86cd799439011",
      }),
    );
  });

  it("connects successfully when account and token are valid", async () => {
    mockGetServerSession.mockResolvedValue({
      user: { id: "507f1f77bcf86cd799439011" },
    });
    mockUserLookup({
      instagramAccessToken: "llat-token",
      availableIgAccounts: [{ igAccountId: "ig_valid" }],
    });
    mockConnectInstagramAccount.mockResolvedValue({ success: true });

    const res = await POST(makeRequest({ instagramAccountId: "ig_valid" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.reconnectFlowId).toMatch(/^igrc_/);
    expect(mockConnectInstagramAccount).toHaveBeenCalledTimes(1);
    expect(mockMarkTrialInstagramConnected).toHaveBeenCalledWith(
      "507f1f77bcf86cd799439011",
      "ig_valid",
    );
    expect(mockRecordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        eventName: "post_creation_instagram_connected",
        userId: "507f1f77bcf86cd799439011",
      }),
    );
  });
});
