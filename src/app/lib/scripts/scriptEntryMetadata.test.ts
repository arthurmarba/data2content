import { getNormalizedScriptEntryMetadata } from "./scriptEntryMetadata";

describe("scripts/scriptEntryMetadata", () => {
  it("fills missing metadata for legacy standalone manual scripts", () => {
    expect(
      getNormalizedScriptEntryMetadata({
        source: undefined,
        linkType: undefined,
        plannerRef: null,
        aiVersionId: null,
      })
    ).toEqual({
      source: "manual",
      linkType: "standalone",
    });
  });

  it("infers planner metadata from planner slot linkage", () => {
    expect(
      getNormalizedScriptEntryMetadata({
        source: undefined,
        linkType: undefined,
        plannerRef: {
          slotId: "slot-1",
          weekStart: new Date("2026-03-16T00:00:00.000Z"),
        },
      })
    ).toEqual({
      source: "planner",
      linkType: "planner_slot",
    });
  });

  it("infers ai source when the script has an ai version id", () => {
    expect(
      getNormalizedScriptEntryMetadata({
        source: undefined,
        linkType: undefined,
        plannerRef: null,
        aiVersionId: "ai_123",
      })
    ).toEqual({
      source: "ai",
      linkType: "standalone",
    });
  });

  it("preserves valid stored metadata", () => {
    expect(
      getNormalizedScriptEntryMetadata({
        source: "manual",
        linkType: "planner_slot",
        plannerRef: null,
        aiVersionId: "ai_123",
      })
    ).toEqual({
      source: "manual",
      linkType: "planner_slot",
    });
  });
});
