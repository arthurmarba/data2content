import {
  buildQuarantineResolutionKey,
  getReviewedQuarantineResolution,
  getSuggestedCrossDimensionResolution,
} from "@/app/lib/classificationQuarantineResolution";

describe("classification quarantine resolution helpers", () => {
  it("builds stable case-insensitive keys", () => {
    expect(buildQuarantineResolutionKey("format", " Announcement ")).toBe("format::announcement");
  });

  it("returns null when no reviewed rule exists", () => {
    expect(getReviewedQuarantineResolution("tone", "critical")).toBeNull();
  });

  it("returns reviewed drop rules for placeholder garbage", () => {
    expect(getReviewedQuarantineResolution("context", "[]")).toEqual({
      sourceField: "context",
      raw: "[]",
      action: "drop_from_quarantine",
    });
    expect(getReviewedQuarantineResolution("references", "[]")).toEqual({
      sourceField: "references",
      raw: "[]",
      action: "drop_from_quarantine",
    });
  });

  it("returns reviewed policy rules for known residuals", () => {
    expect(getReviewedQuarantineResolution("references", "general")).toEqual({
      sourceField: "references",
      raw: "general",
      action: "drop_from_quarantine",
    });
    expect(getReviewedQuarantineResolution("format", "announcement")).toEqual({
      sourceField: "format",
      raw: "announcement",
      action: "append_to_target",
      targetField: "proposal",
      targetId: "announcement",
    });
    expect(getReviewedQuarantineResolution("references", "pop_culture_people")).toEqual({
      sourceField: "references",
      raw: "pop_culture_people",
      action: "append_to_target",
      targetField: "references",
      targetId: "pop_culture",
    });
  });

  it("suggests unique cross-dimension resolutions only", () => {
    expect(getSuggestedCrossDimensionResolution("format", "announcement")).toEqual({
      sourceField: "format",
      raw: "announcement",
      action: "append_to_target",
      targetField: "proposal",
      targetId: "announcement",
    });
    expect(getSuggestedCrossDimensionResolution("context", "desconhecido")).toBeNull();
    expect(getSuggestedCrossDimensionResolution("context", "fashion_style")).toBeNull();
  });
});
