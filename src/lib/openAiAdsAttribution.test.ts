import { normalizeOpenAiOppref } from "./openAiAdsAttribution";

describe("OpenAI Ads attribution", () => {
  it("preserves an opaque oppref without modifying it", () => {
    const oppref = "oai_AbC-123.x_y%2Fz";
    expect(normalizeOpenAiOppref(oppref)).toBe(oppref);
  });

  it.each([null, undefined, "", "with space", "line\nbreak", "a;cookie=evil"])(
    "rejects unsafe value %p",
    (value) => {
      expect(normalizeOpenAiOppref(value)).toBeNull();
    },
  );

  it("rejects oversized identifiers", () => {
    expect(normalizeOpenAiOppref("a".repeat(2_049))).toBeNull();
  });
});
