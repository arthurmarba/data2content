/** @jest-environment node */

import { GET } from "./route";

describe("MCP health route", () => {
  const originalFlag = process.env.MCP_CAMPAIGN_RADAR_ENABLED;

  afterEach(() => {
    if (originalFlag === undefined) delete process.env.MCP_CAMPAIGN_RADAR_ENABLED;
    else process.env.MCP_CAMPAIGN_RADAR_ENABLED = originalFlag;
  });

  it("reports the same version and rollout state as the MCP server", async () => {
    delete process.env.MCP_CAMPAIGN_RADAR_ENABLED;
    const current = await (await GET()).json();
    expect(current).toMatchObject({ version: "0.8.0", campaignRadarEnabled: false });

    process.env.MCP_CAMPAIGN_RADAR_ENABLED = "1";
    const future = await (await GET()).json();
    expect(future).toMatchObject({ version: "0.9.0", campaignRadarEnabled: true });
  });
});
