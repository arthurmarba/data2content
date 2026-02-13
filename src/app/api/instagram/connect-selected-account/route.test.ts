/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import { connectToDatabase } from "@/app/lib/mongoose";
import User from "@/app/models/User";
import { connectInstagramAccount } from "@/app/lib/instagram";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({ resolveAuthOptions: jest.fn().mockResolvedValue({}) }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ findById: jest.fn(), findByIdAndUpdate: jest.fn() }));
jest.mock("@/app/lib/instagram", () => ({ connectInstagramAccount: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() } }));

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnectToDatabase = connectToDatabase as jest.Mock;
const mockFindById = (User as any).findById as jest.Mock;
const mockFindByIdAndUpdate = (User as any).findByIdAndUpdate as jest.Mock;
const mockConnectInstagramAccount = connectInstagramAccount as jest.Mock;
const { POST } = require("./route");

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/instagram/connect-selected-account", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
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
    mockGetServerSession.mockResolvedValue({ user: { id: "507f1f77bcf86cd799439011" } });
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
    mockGetServerSession.mockResolvedValue({ user: { id: "507f1f77bcf86cd799439011" } });
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

  it("connects successfully when account and token are valid", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "507f1f77bcf86cd799439011" } });
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
  });
});
