/** @jest-environment node */

import {
  getMcpConnectionScopes,
  getMcpProfileUrl,
  getMcpSupportedScopes,
  isMcpAdminEnabled,
  isMcpCampaignRadarEnabled,
} from "./config";

describe("MCP configuration", () => {
  const originalValue = process.env.MCP_ADMIN_ENABLED;
  const originalAppUrl = process.env.NEXT_PUBLIC_APP_URL;
  const originalCampaignRadar = process.env.MCP_CAMPAIGN_RADAR_ENABLED;
  const originalSupportedScopes = process.env.MCP_SUPPORTED_SCOPES;
  const originalConnectionScopes = process.env.MCP_CONNECTION_SCOPES;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.MCP_ADMIN_ENABLED;
    } else {
      process.env.MCP_ADMIN_ENABLED = originalValue;
    }
    if (originalAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL;
    } else {
      process.env.NEXT_PUBLIC_APP_URL = originalAppUrl;
    }
    for (const [name, value] of [
      ["MCP_CAMPAIGN_RADAR_ENABLED", originalCampaignRadar],
      ["MCP_SUPPORTED_SCOPES", originalSupportedScopes],
      ["MCP_CONNECTION_SCOPES", originalConnectionScopes],
    ] as const) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  });

  it("accepts an enabled flag surrounded by environment-manager whitespace", () => {
    process.env.MCP_ADMIN_ENABLED = " 1\n";
    expect(isMcpAdminEnabled()).toBe(true);
  });

  it.each([undefined, "", "0", "true", "yes"])("rejects non-enabled value %p", (value) => {
    if (value === undefined) {
      delete process.env.MCP_ADMIN_ENABLED;
    } else {
      process.env.MCP_ADMIN_ENABLED = value;
    }
    expect(isMcpAdminEnabled()).toBe(false);
  });

  it("sends ChatGPT users directly to their personalized profile", () => {
    process.env.NEXT_PUBLIC_APP_URL = "https://data2content.ai";

    expect(getMcpProfileUrl()).toBe(
      "https://data2content.ai/dashboard/profile?source=chatgpt",
    );
  });

  it("keeps the campaign radar disabled unless the exact rollout flag is enabled", () => {
    process.env.MCP_CAMPAIGN_RADAR_ENABLED = "true";
    expect(isMcpCampaignRadarEnabled()).toBe(false);
    process.env.MCP_CAMPAIGN_RADAR_ENABLED = " 1\n";
    expect(isMcpCampaignRadarEnabled()).toBe(true);
  });

  it("adds the campaign read scope only during the campaign radar rollout", () => {
    process.env.MCP_SUPPORTED_SCOPES = "profile:read,content:read";
    process.env.MCP_CONNECTION_SCOPES = "profile:read,content:read";
    delete process.env.MCP_CAMPAIGN_RADAR_ENABLED;
    expect(getMcpSupportedScopes()).not.toContain("campaigns:read");
    expect(getMcpConnectionScopes()).not.toContain("campaigns:read");

    process.env.MCP_CAMPAIGN_RADAR_ENABLED = "1";
    expect(getMcpSupportedScopes()).toContain("campaigns:read");
    expect(getMcpConnectionScopes()).toContain("campaigns:read");
  });
});
