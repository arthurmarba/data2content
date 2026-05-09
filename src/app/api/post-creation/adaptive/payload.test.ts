/** @jest-environment node */
import {
  isValidAdaptivePlanBody,
  isValidAdaptiveStartBody,
  normalizeAdaptivePlanBody,
  normalizeAdaptiveStartBody,
} from "@/app/api/post-creation/adaptive/payload";
import { detectPostCreationAdaptiveIntent } from "@/app/dashboard/boards/postCreationAdaptiveRouter";
import { buildPostCreationAdaptiveQuiz } from "@/app/dashboard/boards/postCreationAdaptiveQuizBuilder";

describe("post creation adaptive payload", () => {
  it("trims adaptive start input", () => {
    const normalized = normalizeAdaptiveStartBody({ input: "  Quero gravar um reels  " });

    expect(normalized.input).toBe("Quero gravar um reels");
  });

  it("cuts adaptive start input above 1000 characters", () => {
    const normalized = normalizeAdaptiveStartBody({ input: ` ${"a".repeat(1200)} ` });

    expect(normalized.input).toHaveLength(1000);
    expect(isValidAdaptiveStartBody(normalized)).toBe(true);
  });

  it("marks start body without input as invalid", () => {
    const normalized = normalizeAdaptiveStartBody({});

    expect(normalized.input).toBe("");
    expect(isValidAdaptiveStartBody(normalized)).toBe(false);
  });

  it("accepts valid detection, questions, and answers", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero gerar mais comentários");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const normalized = normalizeAdaptivePlanBody({
      detection,
      questions,
      answers: [
        {
          questionId: questions[0]!.id,
          key: questions[0]!.mapKey,
          optionId: questions[0]!.options[0]!.id,
          value: questions[0]!.options[0]!.label,
        },
      ],
    });

    expect(normalized.detection?.mode).toBe("create_by_goal");
    expect(normalized.questions).toHaveLength(questions.length);
    expect(normalized.answers).toHaveLength(1);
    expect(isValidAdaptivePlanBody(normalized)).toBe(true);
  });

  it("marks plan body without detection as invalid", () => {
    const normalized = normalizeAdaptivePlanBody({ questions: [], answers: [] });

    expect(normalized.detection).toBeNull();
    expect(isValidAdaptivePlanBody(normalized)).toBe(false);
  });

  it("normalizes non-array questions to [] and marks plan body invalid", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero gerar mais comentários");
    const normalized = normalizeAdaptivePlanBody({ detection, questions: "bad", answers: [] });

    expect(normalized.questions).toEqual([]);
    expect(isValidAdaptivePlanBody(normalized)).toBe(false);
  });

  it("normalizes non-array answers to []", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero gerar mais comentários");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const normalized = normalizeAdaptivePlanBody({ detection, questions, answers: "bad" });

    expect(normalized.answers).toEqual([]);
    expect(isValidAdaptivePlanBody(normalized)).toBe(true);
  });

  it("normalizes missing targetUserId to empty string", () => {
    expect(normalizeAdaptiveStartBody({ input: "ok" }).targetUserId).toBe("");
    expect(normalizeAdaptivePlanBody(null).targetUserId).toBe("");
  });

  it("does not break with strange or null payloads", () => {
    expect(() => normalizeAdaptiveStartBody(null)).not.toThrow();
    expect(() => normalizeAdaptivePlanBody(null)).not.toThrow();
    expect(normalizeAdaptivePlanBody({ detection: [], questions: {}, answers: 1 })).toEqual(
      expect.objectContaining({
        detection: null,
        questions: [],
        answers: [],
        targetUserId: "",
      })
    );
  });

  it("validates payload produced by router plus quiz plus simulated answers", () => {
    const detection = detectPostCreationAdaptiveIntent("Quero atrair marcas de skincare");
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const answers = questions.slice(0, 2).map((question) => ({
      questionId: question.id,
      key: question.mapKey,
      optionId: question.options[0]!.id,
      value: question.options[0]!.label,
    }));
    const normalized = normalizeAdaptivePlanBody({ detection, questions, answers });

    expect(isValidAdaptivePlanBody(normalized)).toBe(true);
  });
});
