import {
  buildStablePostCreationAdaptiveSnapshotSignature,
  extractPostCreationAdaptiveSnapshotFromDraftState,
  mergePostCreationAdaptiveSnapshotIntoDraftState,
} from "./postCreationDraftAdaptiveState";
import { createEmptyPostCreationFunnelState } from "./postCreationFunnel";
import {
  createEmptyPostCreationAdaptiveSnapshot,
  isMeaningfulPostCreationAdaptiveSnapshot,
  type PostCreationAdaptiveSnapshot,
} from "./postCreationAdaptiveSnapshot";

const legacyState = createEmptyPostCreationFunnelState();

const snapshotFixture: PostCreationAdaptiveSnapshot = {
  input: "Quero validar uma pauta",
  status: "quiz",
  detection: null,
  questions: [
    {
      id: "q-objective",
      type: "strategic_choice",
      title: "Qual objetivo?",
      mapKey: "objective",
      required: true,
      options: [
        { id: "comments", label: "Comentários" },
        { id: "reach", label: "Alcance" },
        { id: "saves", label: "Salvamentos" },
      ],
    },
  ],
  answers: [],
  plan: null,
  legacyHandoff: null,
  error: null,
  updatedAt: "2026-05-09T12:00:00.000Z",
};

describe("post creation draft adaptive state helpers", () => {
  it("merge keeps legacy fields and adds adaptive", () => {
    const merged = mergePostCreationAdaptiveSnapshotIntoDraftState(legacyState, snapshotFixture);

    expect(merged.stage).toBe(legacyState.stage);
    expect(merged.decision).toEqual(legacyState.decision);
    expect((merged as { adaptive?: PostCreationAdaptiveSnapshot }).adaptive).toEqual(snapshotFixture);
  });

  it("merge does not add adaptive when snapshot is null", () => {
    const merged = mergePostCreationAdaptiveSnapshotIntoDraftState(legacyState, null);

    expect("adaptive" in merged).toBe(false);
  });

  it("merge does not add adaptive when snapshot is empty or not significant", () => {
    const merged = mergePostCreationAdaptiveSnapshotIntoDraftState(
      legacyState,
      createEmptyPostCreationAdaptiveSnapshot(),
    );

    expect("adaptive" in merged).toBe(false);
  });

  it("extract returns null when there is no adaptive state", () => {
    expect(extractPostCreationAdaptiveSnapshotFromDraftState(legacyState)).toBeNull();
  });

  it("extract does not break with invalid adaptive state", () => {
    expect(extractPostCreationAdaptiveSnapshotFromDraftState({ ...legacyState, adaptive: "bad" })).toBeNull();
  });

  it("stable signature ignores updatedAt", () => {
    const first = buildStablePostCreationAdaptiveSnapshotSignature(snapshotFixture);
    const second = buildStablePostCreationAdaptiveSnapshotSignature({
      ...snapshotFixture,
      updatedAt: "2026-05-09T13:00:00.000Z",
    });

    expect(first).toBe(second);
  });

  it("stable signature changes when input changes", () => {
    expect(buildStablePostCreationAdaptiveSnapshotSignature(snapshotFixture)).not.toBe(
      buildStablePostCreationAdaptiveSnapshotSignature({
        ...snapshotFixture,
        input: "Outro input",
      }),
    );
  });

  it("stable signature changes when answers change", () => {
    expect(buildStablePostCreationAdaptiveSnapshotSignature(snapshotFixture)).not.toBe(
      buildStablePostCreationAdaptiveSnapshotSignature({
        ...snapshotFixture,
        answers: [
          {
            questionId: "q-objective",
            key: "objective",
            optionId: "comments",
            value: "Comentários",
          },
        ],
      }),
    );
  });

  it("stable signature changes when plan changes", () => {
    expect(buildStablePostCreationAdaptiveSnapshotSignature(snapshotFixture)).not.toBe(
      buildStablePostCreationAdaptiveSnapshotSignature({
        ...snapshotFixture,
        plan: {
          pauta: "Pauta pronta",
          objective: "Comentários",
          narrative: "POV",
          format: "Reels",
          hook: "POV",
          cta: "Comente",
          fiveW2H: {
            who: "Creator",
            what: "Gravar",
            where: "Casa",
            when: "Hoje",
            why: "Identificação",
            how: "Cena curta",
            howMuch: "Baixo",
          },
          scenes: [
            { id: "scene-1", title: "Gancho", visual: "Creator", message: "POV" },
            { id: "scene-2", title: "Contexto", visual: "Casa", message: "Mostre" },
            { id: "scene-3", title: "CTA", visual: "Fechamento", message: "Comente" },
          ],
          brandMatch: null,
          collabMatch: null,
          nextActions: ["generate_script"],
        },
      }),
    );
  });

  it("empty snapshot is not meaningful", () => {
    expect(isMeaningfulPostCreationAdaptiveSnapshot(createEmptyPostCreationAdaptiveSnapshot())).toBe(false);
  });

  it("snapshot with real input is meaningful", () => {
    expect(
      isMeaningfulPostCreationAdaptiveSnapshot({
        ...createEmptyPostCreationAdaptiveSnapshot(),
        input: "me ajuda",
      }),
    ).toBe(true);
  });

  it("snapshot with questions or answers is meaningful", () => {
    expect(
      isMeaningfulPostCreationAdaptiveSnapshot({
        ...createEmptyPostCreationAdaptiveSnapshot(),
        questions: snapshotFixture.questions,
      }),
    ).toBe(true);
    expect(
      isMeaningfulPostCreationAdaptiveSnapshot({
        ...createEmptyPostCreationAdaptiveSnapshot(),
        answers: [
          {
            questionId: "q-objective",
            key: "objective",
            optionId: "comments",
            value: "Comentários",
          },
        ],
      }),
    ).toBe(true);
  });

  it("snapshot with plan is meaningful", () => {
    expect(
      isMeaningfulPostCreationAdaptiveSnapshot({
        ...createEmptyPostCreationAdaptiveSnapshot(),
        plan: {
          pauta: "Pauta pronta",
          objective: "Comentários",
          narrative: "POV",
          format: "Reels",
          hook: "POV",
          cta: "Comente",
          fiveW2H: {
            who: "Creator",
            what: "Gravar",
            where: "Casa",
            when: "Hoje",
            why: "Identificação",
            how: "Cena curta",
            howMuch: "Baixo",
          },
          scenes: [
            { id: "scene-1", title: "Gancho", visual: "Creator", message: "POV" },
            { id: "scene-2", title: "Contexto", visual: "Casa", message: "Mostre" },
            { id: "scene-3", title: "CTA", visual: "Fechamento", message: "Comente" },
          ],
          brandMatch: null,
          collabMatch: null,
          nextActions: ["generate_script"],
        },
      }),
    ).toBe(true);
  });
});
