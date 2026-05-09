import {
  createEmptyPostCreationAdaptiveSnapshot,
  normalizePostCreationAdaptiveSnapshot,
} from "./postCreationAdaptiveSnapshot";
import type { PostCreationAdaptiveSnapshot } from "./postCreationAdaptiveSnapshot";

const snapshotFixture: PostCreationAdaptiveSnapshot = {
  input: "Quero atrair marcas",
  status: "plan_ready",
  detection: {
    mode: "brand_match",
    confidence: 0.85,
    normalizedInput: "quero atrair marcas",
    originalInput: "Quero atrair marcas",
    detectedPauta: null,
    objective: null,
    brandCategory: "beleza",
    sourceComment: null,
    signals: ["marca"],
    suggestedStage: "quiz",
  },
  questions: [
    {
      id: "q-brand",
      type: "strategic_choice",
      title: "Que marca?",
      mapKey: "brand",
      required: true,
      options: [
        { id: "beauty", label: "Beleza" },
        { id: "tech", label: "Tecnologia" },
        { id: "home", label: "Casa" },
      ],
    },
  ],
  answers: [
    {
      questionId: "q-brand",
      key: "brand",
      optionId: "beauty",
      value: "Beleza",
    },
  ],
  plan: {
    pauta: "Rotina com marca de beleza",
    objective: "Atrair marcas",
    narrative: "Rotina real",
    format: "Reels",
    hook: "POV",
    cta: "Comenta sua rotina",
    fiveW2H: {
      who: "Creator",
      what: "Mostrar rotina",
      where: "Em casa",
      when: "Hoje",
      why: "Match orgânico",
      how: "Cena real",
      howMuch: "Médio",
    },
    scenes: [
      {
        id: "scene-1",
        title: "Gancho",
        visual: "Creator",
        message: "POV",
      },
      {
        id: "scene-2",
        title: "Contexto",
        visual: "Rotina",
        message: "Mostre o uso",
      },
      {
        id: "scene-3",
        title: "CTA",
        visual: "Fechamento",
        message: "Comente",
      },
    ],
    brandMatch: {
      enabled: true,
      category: "beleza",
      angle: "rotina real",
    },
    collabMatch: null,
    nextActions: ["see_brands"],
  },
  legacyHandoff: null,
  error: null,
  updatedAt: "2026-05-09T12:00:00.000Z",
};

describe("normalizePostCreationAdaptiveSnapshot", () => {
  it("returns null for null or strange values", () => {
    expect(normalizePostCreationAdaptiveSnapshot(null)).toBeNull();
    expect(normalizePostCreationAdaptiveSnapshot("bad")).toBeNull();
    expect(normalizePostCreationAdaptiveSnapshot([])).toBeNull();
  });

  it("normalizes invalid arrays to empty arrays", () => {
    const normalized = normalizePostCreationAdaptiveSnapshot({
      input: "ok",
      status: "quiz",
      questions: "bad",
      answers: "bad",
    });

    expect(normalized?.questions).toEqual([]);
    expect(normalized?.answers).toEqual([]);
  });

  it("converts starting status to a safe state", () => {
    expect(normalizePostCreationAdaptiveSnapshot({ status: "starting" })?.status).toBe("idle");
    expect(
      normalizePostCreationAdaptiveSnapshot({
        status: "starting",
        questions: snapshotFixture.questions,
      })?.status,
    ).toBe("quiz");
  });

  it("converts planning status to a safe state", () => {
    expect(
      normalizePostCreationAdaptiveSnapshot({
        status: "planning",
        questions: snapshotFixture.questions,
      })?.status,
    ).toBe("quiz");
    expect(
      normalizePostCreationAdaptiveSnapshot({
        status: "planning",
        questions: snapshotFixture.questions,
        plan: snapshotFixture.plan,
      })?.status,
    ).toBe("plan_ready");
  });

  it("preserves plan_ready when a plan exists", () => {
    const normalized = normalizePostCreationAdaptiveSnapshot(snapshotFixture);

    expect(normalized?.status).toBe("plan_ready");
    expect(normalized?.plan).toEqual(snapshotFixture.plan);
  });

  it("creates an empty serializable snapshot", () => {
    expect(createEmptyPostCreationAdaptiveSnapshot()).toMatchObject({
      input: "",
      status: "idle",
      detection: null,
      questions: [],
      answers: [],
      plan: null,
      legacyHandoff: null,
      error: null,
    });
  });
});
