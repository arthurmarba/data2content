import { isNarrativeSourceEngineEnabled } from "./narrativeSourceFeatureFlag";

const originalEnvValue = process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED;

afterEach(() => {
  if (originalEnvValue === undefined) {
    delete process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED;
    return;
  }

  process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = originalEnvValue;
});

describe("narrativeSourceFeatureFlag", () => {
  it("enables NSE when env flag is 1", () => {
    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "1";

    expect(isNarrativeSourceEngineEnabled()).toBe(true);
  });

  it("keeps NSE disabled when env flag is absent or off", () => {
    delete process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED;
    expect(isNarrativeSourceEngineEnabled()).toBe(false);

    process.env.NEXT_PUBLIC_NARRATIVE_SOURCE_ENGINE_ENABLED = "0";
    expect(isNarrativeSourceEngineEnabled()).toBe(false);
  });
});
