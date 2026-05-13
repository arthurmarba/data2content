import { buildPostCreationAdaptiveAnswerKey } from "./postCreationAdaptiveAnswerKey";
import { buildPostCreationAdaptiveQuiz } from "./postCreationAdaptiveQuizBuilder";
import {
  buildPostCreationAdaptiveStudyContextFromServerSources,
  normalizeServerPostFormat,
  resolvePostComments,
  resolvePostSaves,
  resolvePostShares,
  resolvePostViews,
  resolveTotalInteractions,
  toFiniteNumber,
  type PostCreationAdaptiveServerMetricPost,
} from "./postCreationAdaptiveStudyContextServer";
import type { PostCreationAdaptiveIntentDetection } from "./postCreationAdaptiveTypes";

function formatGuidanceDetection(): PostCreationAdaptiveIntentDetection {
  return {
    mode: "format_guidance",
    confidence: 0.9,
    normalizedInput: "qual formato usar",
    originalInput: "Qual formato devo usar para essa pauta?",
    detectedPauta: "essa pauta",
    objective: null,
    brandCategory: null,
    sourceComment: null,
    signals: ["formato"],
    suggestedStage: "quiz",
  };
}

const strongPost: PostCreationAdaptiveServerMetricPost = {
  id: "post-strong",
  instagramMediaId: "media-strong",
  type: "REEL",
  format: "REEL",
  description: "Voce ja passou por isso? Comenta e salva para lembrar depois.",
  title: "Rotina que gerou conversa",
  postDate: "2026-04-15T19:00:00.000Z",
  postLink: "https://instagram.com/p/strong",
  coverUrl: "https://cdn.example.com/strong.jpg",
  context: ["Rotina", "Casa"],
  proposal: "Identificacao",
  tone: "Humor",
  references: ["POV"],
  contentIntent: "Gerar conversa",
  narrativeForm: ["Cena real", "POV"],
  contentSignals: ["Comentavel", "Salvavel", "Comentavel"],
  stance: "Reacao",
  proofStyle: "Cena real",
  commercialMode: "Uso real de produto",
  theme: ["Familia", "Rotina"],
  themeKeyword: "barulho",
  isPubli: true,
  collab: true,
  collabCreator: "Creator de rotina",
  stats: {
    views: 44_000,
    reach: 31_000,
    likes: 900,
    comments: 120,
    saved: 80,
    shares: 140,
    total_interactions: 1_450,
  },
};

const weakerPost: PostCreationAdaptiveServerMetricPost = {
  id: "post-weaker",
  type: "CAROUSEL_ALBUM",
  description: "Checklist de skincare para consultar depois. Salva este passo a passo.",
  title: "Checklist de skincare",
  postDate: "2026-04-13T12:00:00.000Z",
  postLink: "https://instagram.com/p/weaker",
  context: "Tutorial",
  proposal: ["Salvamento"],
  tone: ["Didatico"],
  contentIntent: ["Gerar salvamento"],
  narrativeForm: "Passo a passo",
  contentSignals: ["Salvavel"],
  proofStyle: ["Checklist"],
  theme: "Skincare",
  themeKeyword: ["rotina", "protetor"],
  stats: {
    likes: 100,
    comments: 10,
    saves: 60,
    shares: 15,
    reach: 4_000,
  },
};

describe("buildPostCreationAdaptiveStudyContextFromServerSources", () => {
  it("returns a safe empty StudyContext and zero coverage", () => {
    const result = buildPostCreationAdaptiveStudyContextFromServerSources({});

    expect(result.studyContext.source).toBe("planner_client");
    expect(result.studyContext.confidence.label).toBe("low");
    expect(result.studyContext.topFormats).toEqual([]);
    expect(result.studyContext.topHooks).toEqual([]);
    expect(result.coverage).toEqual({
      source: "server",
      postsAnalyzed: 0,
      postsWithMetrics: 0,
      postsWithCaption: 0,
      postsClassified: 0,
      postsWithCommercialSignals: 0,
      postsWithCollabSignals: 0,
      hasAccountInsight: false,
      hasAudienceDemographics: false,
      hasBrandSignals: false,
      hasCollabSignals: false,
      periodDays: 90,
      generatedAt: null,
    });
  });

  it("normalizes real post fields into StudyContext signals and reference posts", () => {
    const { studyContext } = buildPostCreationAdaptiveStudyContextFromServerSources({
      posts: [strongPost],
      periodDays: 30,
    });

    expect(studyContext.periodDays).toBe(30);
    expect(studyContext.topFormats.map((signal) => signal.label)).toContain("Reels");
    expect(studyContext.topContexts.map((signal) => signal.label)).toContain("Rotina");
    expect(studyContext.topProposals.map((signal) => signal.label)).toContain("Identificacao");
    expect(studyContext.topTones.map((signal) => signal.label)).toContain("Humor");
    expect(studyContext.referencePosts[0]).toEqual(
      expect.objectContaining({
        id: "post-strong",
        title: "Rotina que gerou conversa",
        caption: "Voce ja passou por isso? Comenta e salva para lembrar depois.",
        permalink: "https://instagram.com/p/strong",
        format: "Reels",
        interactions: 1450,
        comments: 120,
        saves: 80,
        shares: 140,
      }),
    );
  });

  it("normalizes metrics defensively", () => {
    const explicit: PostCreationAdaptiveServerMetricPost = {
      stats: {
        total_interactions: "500",
        likes: 10,
        comments: 20,
        saved: 30,
        shares: 40,
      },
    };
    const calculated: PostCreationAdaptiveServerMetricPost = {
      likes: 100,
      comments: "20",
      saved: 15,
      shares: 5,
      views: "1200",
    };
    const unsafe: PostCreationAdaptiveServerMetricPost = {
      likes: -10,
      comments: Number.NaN,
      saved: "nope",
      shares: -1,
    };

    expect(toFiniteNumber(Number.NaN)).toBe(0);
    expect(toFiniteNumber(-5)).toBe(0);
    expect(resolveTotalInteractions(explicit)).toBe(500);
    expect(resolveTotalInteractions(calculated)).toBe(140);
    expect(resolveTotalInteractions(unsafe)).toBe(0);
    expect(resolvePostViews(calculated)).toBe(1200);
    expect(resolvePostComments(calculated)).toBe(20);
    expect(resolvePostSaves(calculated)).toBe(15);
    expect(resolvePostShares(calculated)).toBe(5);
  });

  it("normalizes common Instagram media formats", () => {
    expect(normalizeServerPostFormat("REEL")).toBe("Reels");
    expect(normalizeServerPostFormat("VIDEO")).toBe("Reels");
    expect(normalizeServerPostFormat("CAROUSEL_ALBUM")).toBe("Carrossel");
    expect(normalizeServerPostFormat("IMAGE")).toBe("Foto");
    expect(normalizeServerPostFormat("story")).toBe("Stories");
  });

  it("accepts string and array classifications while removing duplicate labels", () => {
    const { studyContext } = buildPostCreationAdaptiveStudyContextFromServerSources({
      posts: [strongPost],
    });

    expect(studyContext.topContentIntents.map((signal) => signal.label)).toContain("Gerar conversa");
    expect(studyContext.topNarrativeForms.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Cena real", "POV"]),
    );
    expect(studyContext.topStances.map((signal) => signal.label)).toContain("Reacao");
    expect(studyContext.topProofStyles.map((signal) => signal.label)).toContain("Cena real");
    expect(studyContext.topCommercialModes.map((signal) => signal.label)).toContain("Uso real de produto");
    expect(studyContext.topEngagementDrivers.filter((signal) => signal.label === "Comentavel")).toHaveLength(1);
  });

  it("extracts hook, CTA, and caption keyword signals from captions", () => {
    const { studyContext } = buildPostCreationAdaptiveStudyContextFromServerSources({
      posts: [strongPost, weakerPost],
    });

    expect(studyContext.topHooks.map((signal) => signal.label)).toContain("Voce ja passou por isso?");
    expect(studyContext.topCtas.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Comentar", "Salvar"]),
    );
    expect(studyContext.topCaptionSignals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["passou", "checklist"]),
    );
  });

  it("sorts and limits reference posts by performance", () => {
    const posts = Array.from({ length: 12 }, (_, index): PostCreationAdaptiveServerMetricPost => ({
      id: `post-${index}`,
      type: index % 2 === 0 ? "REEL" : "IMAGE",
      title: `Post ${index}`,
      description: `Legenda ${index}`,
      stats: {
        total_interactions: 100 + index,
        comments: index,
        saved: index + 1,
        shares: index + 2,
        reach: 1000 + index,
      },
    }));

    const { studyContext } = buildPostCreationAdaptiveStudyContextFromServerSources({ posts });

    expect(studyContext.referencePosts).toHaveLength(8);
    expect(studyContext.referencePosts[0]?.id).toBe("post-11");
    expect(studyContext.referencePosts[0]?.comments).toBe(11);
    expect(studyContext.referencePosts[0]?.saves).toBe(12);
    expect(studyContext.referencePosts[0]?.shares).toBe(13);
  });

  it("creates commercial and collab signals from posts", () => {
    const { studyContext } = buildPostCreationAdaptiveStudyContextFromServerSources({
      posts: [strongPost],
    });

    expect(studyContext.brandSignals.map((signal) => signal.label)).toEqual(
      expect.arrayContaining(["Conteudo com sinal comercial", "Uso real de produto"]),
    );
    expect(studyContext.collabSignals.map((signal) => signal.label)).toContain("Creator de rotina");
  });

  it("counts coverage for loaded server sources", () => {
    const { coverage } = buildPostCreationAdaptiveStudyContextFromServerSources({
      posts: [strongPost, weakerPost],
      accountInsight: { reach: 100_000 },
      audienceDemographics: { city: [{ name: "Sao Paulo" }] },
      brandSignals: [{ label: "Beleza" }],
      collabSignals: [{ creatorProfile: "Creator beleza" }],
      periodDays: 60,
      generatedAt: "2026-05-11T00:00:00.000Z",
    });

    expect(coverage).toEqual({
      source: "server",
      postsAnalyzed: 2,
      postsWithMetrics: 2,
      postsWithCaption: 2,
      postsClassified: 2,
      postsWithCommercialSignals: 1,
      postsWithCollabSignals: 1,
      hasAccountInsight: true,
      hasAudienceDemographics: true,
      hasBrandSignals: true,
      hasCollabSignals: true,
      periodDays: 60,
      generatedAt: "2026-05-11T00:00:00.000Z",
    });
  });

  it("produces a StudyContext compatible with AnswerKey and GameContract", () => {
    const detection = formatGuidanceDetection();
    const questions = buildPostCreationAdaptiveQuiz({ detection });
    const { studyContext } = buildPostCreationAdaptiveStudyContextFromServerSources({
      posts: [
        {
          ...weakerPost,
          stats: {
            total_interactions: 3000,
            saved: 500,
            shares: 70,
            comments: 20,
            reach: 20_000,
          },
        },
        strongPost,
      ],
    });
    const answerKey = buildPostCreationAdaptiveAnswerKey({
      detection,
      questions,
      studyContext,
    });

    expect(answerKey.correctAnswersByQuestionId["format-primary"]).toBe("carousel");
    expect(answerKey.gameQuestions).toHaveLength(questions.length);
    expect(answerKey.gameQuestions.every((gameQuestion) => gameQuestion.isValid)).toBe(true);
    expect(answerKey.gameQuestions.every((gameQuestion) => gameQuestion.validationErrors.length === 0)).toBe(true);
  });
});
