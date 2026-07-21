/** @jest-environment node */
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";

import { connectToDatabase } from "@/app/lib/mongoose";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({
  create: jest.fn(),
  findById: jest.fn(),
}));

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnectToDatabase = connectToDatabase as jest.Mock;
const { POST } = require("./route");

function makeRequest(body: Record<string, unknown>) {
  return new NextRequest("http://localhost/api/post-creation/trial/start", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/post-creation/trial/start", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetServerSession.mockResolvedValue(null);
  });

  it("requires explicit legal consent before creating a trial", async () => {
    const res = await POST(makeRequest({}));

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.reason).toBe("legal_consent_required");
    expect(mockConnectToDatabase).not.toHaveBeenCalled();
  });
});
