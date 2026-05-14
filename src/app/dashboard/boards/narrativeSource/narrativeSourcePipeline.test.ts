import fs from "fs";
import path from "path";
import { buildPostCreationAdaptiveAnswerKey } from "../postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveStrategicPlan } from "../postCreationAdaptivePlanBuilder";
import { buildPostCreationAdaptiveQuiz } from "../postCreationAdaptiveQuizBuilder";
import { detectPostCreationAdaptiveIntent } from "../postCreationAdaptiveRouter";
import type { PostCreationAdaptiveAnswer } from "../postCreationAdaptiveTypes";
import { extractNarrativeAssets } from "./narrativeAssetExtractor";
import { buildAdaptiveInputFromNarrativeSource } from "./narrativeSourceAdaptiveAdapter";
import { detectNarrativeSourceIntent } from "./narrativeSourceIntentRouter";
import { createEmptyNarrativeSource, type NarrativeAsset, type NarrativeSource } from "./narrativeSourceTypes";

const forbiddenLanguage = [
  "garantido",
  "certeza",
  "comprovado",
  "viralizar",
  "score",
  "nota",
  "pontuação",
  "acerto",
  "erro",
  "gabarito",
  "resposta correta",
];

function makeSource(params: Partial<NarrativeSource> = {}): NarrativeSource {
  return {
    ...createEmptyNarrativeSource({
      id: params.id || "source-pipeline-test",
      sourceType: params.sourceType || "video_simulated",
    }),
    ...params,
    metadata: params.metadata || {},
  };
}

function runNarrativeSourcePipeline(source: NarrativeSource) {
  const sourceIntent = detectNarrativeSourceIntent(source);
  const extraction = extractNarrativeAssets({ source, intentDetection: sourceIntent });
  const adaptiveInput = buildAdaptiveInputFromNarrativeSource({
    source,
    intentDetection: sourceIntent,
    extraction,
  });
  const adaptiveDetection = detectPostCreationAdaptiveIntent(adaptiveInput.input);
  const questions = buildPostCreationAdaptiveQuiz({ detection: adaptiveDetection });
  const answers: PostCreationAdaptiveAnswer[] = questions.map((question) => {
    const option = question.options.find((candidate) => candidate.recommended) || question.options[0]!;

    return {
      questionId: question.id,
      key: question.mapKey,
      optionId: option.id,
      value: null,
    };
  });
  const answerKey = buildPostCreationAdaptiveAnswerKey({
    detection: adaptiveDetection,
    questions,
    answers,
  });
  const plan = buildPostCreationAdaptiveStrategicPlan({
    detection: adaptiveDetection,
    questions,
    answers,
    answerKey,
  });

  return {
    source,
    sourceIntent,
    extraction,
    adaptiveInput,
    adaptiveDetection,
    questions,
    answers,
    answerKey,
    plan,
  };
}

function assetValues(result: ReturnType<typeof runNarrativeSourcePipeline>, type: NarrativeAsset["type"]) {
  return result.extraction.assets.filter((asset) => asset.type === type).map((asset) => asset.value);
}

const pipelineScenarios = [
  {
    name: "video validate posting",
    source: makeSource({
      creatorQuestion: "Gravei esse vídeo e quero saber se vale postar",
      transcript: "Mostro minha rotina de skincare pela manhã com cuidado e autocuidado.",
      visualDescription: "Pessoa organizando produtos de skincare na bancada.",
    }),
  },
  {
    name: "video improve content",
    source: makeSource({
      creatorQuestion: "Acho que o começo está fraco e queria melhorar o gancho",
      rawText: "Bastidor de trabalho mostrando processo e gravação.",
      transcript: "Mostro uma reunião e o processo de produção do conteúdo.",
    }),
  },
  {
    name: "video discover narrative",
    source: makeSource({
      creatorQuestion: "Não sei qual narrativa esse vídeo comunica",
      transcript: "Bastidor do processo de produção e organização do trabalho.",
      visualDescription: "Mesa com roteiro, gravação e cenas de bastidor.",
    }),
  },
  {
    name: "video brand potential",
    source: makeSource({
      creatorQuestion: "Quero saber se esse vídeo tem potencial para atrair marcas",
      transcript: "Mostro minha rotina de skincare e autocuidado pela manhã.",
    }),
  },
  {
    name: "video adapt to ad",
    source: makeSource({
      creatorQuestion: "Quero transformar esse vídeo em uma publi para uma marca de skincare",
      transcript: "Rotina de autocuidado com produtos organizados na bancada.",
    }),
  },
  {
    name: "video collab",
    source: makeSource({
      creatorQuestion: "Esse vídeo poderia virar uma collab com outro creator?",
      rawText: "Bastidor de trabalho com processo de produção e decisões criativas.",
    }),
  },
  {
    name: "video positioning",
    source: makeSource({
      creatorQuestion: "Quero saber se esse vídeo combina com meu posicionamento e autoridade",
      rawText: "Opinião sobre um tema do mercado com autoridade e identidade própria.",
    }),
  },
  {
    name: "comment to post",
    source: makeSource({
      sourceType: "comment",
      rawText: "Comentaram isso aqui: como você organiza sua rotina? Me perguntaram no direct.",
    }),
  },
  {
    name: "safe fallback",
    source: makeSource(),
  },
];

describe("Narrative Source Engine pipeline QA", () => {
  it("feeds a simulated video validation source into validate_pauta", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[0]!.source);

    expect(result.sourceIntent.intent).toBe("validate_before_posting");
    expect(assetValues(result, "central_theme")).toContain("rotina de autocuidado");
    expect(result.adaptiveInput.modeHint).toBe("validate_pauta");
    expect(result.adaptiveDetection.mode).toBe("validate_pauta");
    expect(result.questions.length).toBeGreaterThanOrEqual(3);
    expect(result.plan.pauta).toBeTruthy();
    expect(result.plan.nextActions.length).toBeGreaterThanOrEqual(3);
  });

  it("feeds a simulated video improvement source into validate_pauta", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[1]!.source);

    expect(result.sourceIntent.intent).toBe("improve_content");
    expect(result.extraction.assets.some((asset) => asset.type === "weakness" || asset.type === "hook_signal")).toBe(true);
    expect(result.adaptiveInput.modeHint).toBe("validate_pauta");
    expect(result.adaptiveDetection.mode).toBe("validate_pauta");
    expect(result.plan.hook || result.plan.fiveW2H.how).toBeTruthy();
    expect(result.answerKey.summary).toBeTruthy();
  });

  it("feeds a simulated narrative discovery source into discover_pauta", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[2]!.source);

    expect(result.sourceIntent.intent).toBe("discover_narrative");
    expect(
      result.extraction.assets.some((asset) => asset.type === "narrative_pattern" || asset.type === "content_proposal")
    ).toBe(true);
    expect(result.adaptiveInput.modeHint).toBe("discover_pauta");
    expect(result.adaptiveDetection.mode).toBe("discover_pauta");
    expect(result.questions[0]?.mapKey).toBe("narrative");
    expect(result.plan.narrative).toBeTruthy();
  });

  it("feeds a simulated brand potential source into brand_match", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[3]!.source);

    expect(result.sourceIntent.intent).toBe("brand_potential");
    expect(result.extraction.assets.some((asset) => asset.type === "brand_territory")).toBe(true);
    expect(result.adaptiveInput.modeHint).toBe("brand_match");
    expect(result.adaptiveDetection.mode).toBe("brand_match");
    expect(result.plan.brandMatch?.enabled).toBe(true);
    expect(result.plan.collabMatch).toBeNull();
  });

  it("feeds a simulated ad adaptation source into brand_match", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[4]!.source);

    expect(result.sourceIntent.intent).toBe("adapt_to_ad");
    expect(result.adaptiveInput.modeHint).toBe("brand_match");
    expect(result.adaptiveDetection.mode).toBe("brand_match");
    expect(result.adaptiveInput.input).toContain("publi");
    expect(result.plan.brandMatch?.enabled).toBe(true);
  });

  it("feeds a simulated collab source into collab_match", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[5]!.source);

    expect(result.sourceIntent.intent).toBe("collab_potential");
    expect(assetValues(result, "collab_opportunity")).toContain("criador complementar");
    expect(result.adaptiveInput.modeHint).toBe("collab_match");
    expect(result.adaptiveDetection.mode).toBe("collab_match");
    expect(result.plan.collabMatch?.enabled).toBe(true);
  });

  it("feeds a simulated positioning source into validate_pauta", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[6]!.source);

    expect(result.sourceIntent.intent).toBe("positioning_fit");
    expect(result.extraction.assets.some((asset) => asset.type === "creator_role" || asset.type === "narrative_pattern")).toBe(true);
    expect(result.adaptiveInput.modeHint).toBe("validate_pauta");
    expect(result.adaptiveDetection.mode).toBe("validate_pauta");
    expect(result.plan.pauta).toBeTruthy();
  });

  it("feeds a comment source into a post path", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[7]!.source);

    expect(assetValues(result, "content_proposal")).toContain("comment_to_post");
    expect(result.adaptiveInput.input).toMatch(/comentaram|perguntaram|rotina/i);
    expect(["comment_to_post", "validate_pauta"]).toContain(result.adaptiveDetection.mode);
    expect(result.plan.pauta).toBeTruthy();
    expect(result.plan.nextActions.length).toBeGreaterThan(0);
  });

  it("keeps sparse sources safe through the full pipeline", () => {
    const result = runNarrativeSourcePipeline(pipelineScenarios[8]!.source);

    expect(result.sourceIntent.intent).toBe("unknown");
    expect(assetValues(result, "central_theme")).toContain("tema ainda pouco definido");
    expect(result.adaptiveInput.input).toBeTruthy();
    expect(["unknown", "validate_pauta"]).toContain(result.adaptiveDetection.mode);
    expect(result.plan.nextActions.length).toBeGreaterThan(0);
  });

  it("keeps generated language safe across the full narrative-to-adaptive pipeline", () => {
    for (const scenario of pipelineScenarios) {
      const result = runNarrativeSourcePipeline(scenario.source);
      const generatedText = JSON.stringify({
        sourceIntent: result.sourceIntent,
        extraction: result.extraction,
        adaptiveInput: result.adaptiveInput,
        adaptiveDetection: result.adaptiveDetection,
        questions: result.questions,
        answerKey: result.answerKey,
        plan: result.plan,
      }).toLowerCase();

      for (const forbidden of forbiddenLanguage) {
        expect(generatedText).not.toContain(forbidden);
      }
    }
  });

  it("keeps the pipeline QA isolated from UI and external dependencies", () => {
    const source = fs.readFileSync(path.join(__dirname, "narrativeSourcePipeline.test.ts"), "utf8");
    const imports = source
      .split("\n")
      .filter((line) => line.startsWith("import "))
      .join("\n");

    expect(imports).not.toMatch(/React|from ["']react["']/);
    expect(imports).not.toMatch(/BoardShell|PostCreationFunnelBoardShell/);
    expect(imports).not.toMatch(/OpenAI|openai/);
    expect(source).not.toMatch(/\bfetch\s*\(/);
    expect(imports).not.toMatch(/Prisma|prisma|banco/);
    expect(imports).not.toMatch(/components?\//);
  });
});
