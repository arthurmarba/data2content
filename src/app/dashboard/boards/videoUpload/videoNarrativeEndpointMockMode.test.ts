import {
  getVideoNarrativeInternalProviderMode,
  resolveVideoNarrativeMockScenarioFromPayload,
} from "./videoNarrativeEndpointMockMode";
import type { VideoNarrativeNormalizedAnalyzePayload } from "./videoNarrativePayloadValidation";

function makePayload(params: {
  creatorQuestion?: string | null;
  knownNarratives?: string[];
}): VideoNarrativeNormalizedAnalyzePayload {
  return {
    id: "mock-mode-test",
    creatorQuestion: params.creatorQuestion ?? null,
    videoUri: "gemini://files/mock-video",
    inlineVideoBase64: null,
    mimeType: null,
    source: "gemini_file_api",
    creatorContext: params.knownNarratives
      ? {
          knownNarratives: params.knownNarratives,
        }
      : null,
  };
}

describe("videoNarrativeEndpointMockMode", () => {
  it("returns disabled by default", () => {
    expect(getVideoNarrativeInternalProviderMode({})).toBe("disabled");
  });

  it("returns mock when VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE is mock", () => {
    expect(
      getVideoNarrativeInternalProviderMode({
        VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE: "mock",
      }),
    ).toBe("mock");
  });

  it("returns real when VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE is real", () => {
    expect(
      getVideoNarrativeInternalProviderMode({
        VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE: "real",
      }),
    ).toBe("real");
  });

  it("does not use NEXT_PUBLIC values", () => {
    expect(
      getVideoNarrativeInternalProviderMode({
        NEXT_PUBLIC_VIDEO_NARRATIVE_INTERNAL_PROVIDER_MODE: "mock",
        VIDEO_NARRATIVE_GEMINI_FLASH_ENABLED: "true",
      }),
    ).toBe("disabled");
  });

  it("resolves brand_potential from marca/publi/brand", () => {
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Como adaptar para marca?" }))).toBe("brand_potential");
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Funciona para publi?" }))).toBe("brand_potential");
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Brand fit?" }))).toBe("brand_potential");
  });

  it("resolves weak_hook from gancho", () => {
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "O gancho está claro?" }))).toBe("weak_hook");
  });

  it("resolves collab_potential from collab or colaboração", () => {
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Dá para fazer collab?" }))).toBe("collab_potential");
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Cabe colaboração?" }))).toBe("collab_potential");
  });

  it("resolves backstage_process from bastidor or processo", () => {
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Esse bastidor vira pauta?" }))).toBe("backstage_process");
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Mostra processo?" }))).toBe("backstage_process");
  });

  it("resolves ad_adaptation from anúncio/adaptação/ad", () => {
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Viraria anúncio?" }))).toBe("ad_adaptation");
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Precisa de adaptação?" }))).toBe("ad_adaptation");
  });

  it("resolves unclear_content from confuso/não sei", () => {
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Está confuso?" }))).toBe("unclear_content");
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Não sei o caminho" }))).toBe("unclear_content");
  });

  it("uses skincare_routine by default and reads knownNarratives", () => {
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ creatorQuestion: "Qual caminho?" }))).toBe("skincare_routine");
    expect(resolveVideoNarrativeMockScenarioFromPayload(makePayload({ knownNarratives: ["gancho"] }))).toBe("weak_hook");
  });
});
