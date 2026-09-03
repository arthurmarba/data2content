/** @jest-environment node */

import { NextRequest } from "next/server";

jest.mock("@/app/lib/mcp/oauth/session", () => ({
  readMcpOAuthSessionUserId: jest.fn(),
}));
jest.mock("@/app/lib/mcp/oauth/service", () => ({
  approveMcpConsent: jest.fn(),
  createMcpConsentRequest: jest.fn(),
  denyMcpConsent: jest.fn(),
}));
jest.mock("@/app/lib/mcp/config", () => ({
  getMcpAppBaseUrl: () => "https://data2content.ai",
}));
jest.mock("../http", () => ({
  oauthErrorResponse: jest.fn((error) => {
    throw error;
  }),
}));

const { readMcpOAuthSessionUserId } = require("@/app/lib/mcp/oauth/session") as {
  readMcpOAuthSessionUserId: jest.Mock;
};
const { GET } = require("./route") as typeof import("./route");

describe("GET /api/mcp/oauth/authorize", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("preserva a solicitação OAuth em callback relativo ao pedir login", async () => {
    readMcpOAuthSessionUserId.mockResolvedValue(null);
    const request = new NextRequest(
      "https://data2content.ai/api/mcp/oauth/authorize?response_type=code&client_id=chatgpt&state=state-1",
    );

    const response = await GET(request);
    const destination = new URL(response.headers.get("location")!);

    expect(destination.origin).toBe("https://data2content.ai");
    expect(destination.pathname).toBe("/login");
    expect(destination.searchParams.get("mcp")).toBe("1");
    expect(destination.searchParams.get("callbackUrl")).toBe(
      "/api/mcp/oauth/authorize?response_type=code&client_id=chatgpt&state=state-1",
    );
  });
});
