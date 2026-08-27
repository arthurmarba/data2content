/** @jest-environment node */

import { isMcpAdminEnabled } from "./config";

describe("MCP configuration", () => {
  const originalValue = process.env.MCP_ADMIN_ENABLED;

  afterEach(() => {
    if (originalValue === undefined) {
      delete process.env.MCP_ADMIN_ENABLED;
    } else {
      process.env.MCP_ADMIN_ENABLED = originalValue;
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
});
