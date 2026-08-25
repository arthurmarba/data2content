import { D2C_INTELLIGENCE_MANIFEST, getPublicIntelligenceManifest } from "./intelligenceContract";

describe("MCP intelligence contract", () => {
  it("maps every public layer to a scope and at least one tool", () => {
    expect(D2C_INTELLIGENCE_MANIFEST.length).toBeGreaterThanOrEqual(7);
    for (const layer of D2C_INTELLIGENCE_MANIFEST) {
      expect(layer.scope).toMatch(/:read$/);
      expect(layer.tools.length).toBeGreaterThan(0);
      expect(layer.fields.length).toBeGreaterThan(0);
    }
  });

  it("documents high-risk fields as intentionally excluded", () => {
    const serialized = JSON.stringify(getPublicIntelligenceManifest());
    expect(serialized).toContain("rawData");
    expect(serialized).toContain("mediaUrl");
    expect(serialized).toContain("email");
    expect(serialized).toContain("location");
    expect(serialized).toContain("privateMetrics");
  });
});
