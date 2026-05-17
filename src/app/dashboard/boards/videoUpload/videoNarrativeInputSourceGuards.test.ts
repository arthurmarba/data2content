import fs from "fs";
import path from "path";

import {
  buildVideoNarrativeInputSourceGuardResult,
  getVideoNarrativeInputSourcePolicy,
  isVideoNarrativeInputSourceAllowedForPhase,
  requiresVideoNarrativeInlinePayload,
  requiresVideoNarrativeMimeTypeForSource,
  requiresVideoNarrativeVideoUri,
  validateVideoNarrativeInputSourceForPhase,
  type VideoNarrativeInputSourcePhase,
} from "./videoNarrativeInputSourceGuards";
import {
  VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST,
  type VideoNarrativeInputSource,
  type VideoNarrativeNormalizedAnalyzePayload,
} from "./videoNarrativePayloadValidation";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativeInputSourceGuards.ts");

function buildPayload(
  overrides: Partial<VideoNarrativeNormalizedAnalyzePayload> = {},
): VideoNarrativeNormalizedAnalyzePayload {
  return {
    id: "manual-video-narrative-run",
    creatorQuestion: null,
    videoUri: "file-uri",
    inlineVideoBase64: null,
    mimeType: null,
    source: "gemini_file_api",
    creatorContext: null,
    ...overrides,
  };
}

function codesFor(params: {
  payload: VideoNarrativeNormalizedAnalyzePayload;
  phase: VideoNarrativeInputSourcePhase;
}): string[] {
  return validateVideoNarrativeInputSourceForPhase(params).issues.map((issue) => issue.code);
}

describe("videoNarrativeInputSourceGuards", () => {
  it("retorna política de manual_real_test", () => {
    expect(getVideoNarrativeInputSourcePolicy("manual_real_test")).toEqual({
      phase: "manual_real_test",
      allowGeminiFileApi: true,
      allowInlineBase64: true,
      allowTemporaryStorage: false,
      allowGcs: false,
      allowS3: false,
      allowR2: false,
      allowPublicUrlRestricted: false,
      requireVideoUriForRemoteSources: true,
      requireMimeTypeForInline: true,
      maxInlineBase64Length: VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST,
    });
  });

  it("retorna política de internal_endpoint", () => {
    expect(getVideoNarrativeInputSourcePolicy("internal_endpoint")).toMatchObject({
      phase: "internal_endpoint",
      allowGeminiFileApi: true,
      allowInlineBase64: true,
      allowTemporaryStorage: true,
      allowGcs: true,
      allowS3: true,
      allowR2: true,
      allowPublicUrlRestricted: false,
    });
  });

  it("retorna política de closed_beta", () => {
    expect(getVideoNarrativeInputSourcePolicy("closed_beta")).toMatchObject({
      phase: "closed_beta",
      allowGeminiFileApi: false,
      allowInlineBase64: false,
      allowTemporaryStorage: true,
      allowGcs: true,
      allowS3: true,
      allowR2: true,
      allowPublicUrlRestricted: false,
      maxInlineBase64Length: 0,
    });
  });

  it("retorna política de production", () => {
    expect(getVideoNarrativeInputSourcePolicy("production")).toMatchObject({
      phase: "production",
      allowGeminiFileApi: false,
      allowInlineBase64: false,
      allowTemporaryStorage: true,
      allowGcs: true,
      allowS3: true,
      allowR2: true,
      allowPublicUrlRestricted: false,
      maxInlineBase64Length: 0,
    });
  });

  it("manual_real_test permite gemini_file_api", () => {
    expect(
      isVideoNarrativeInputSourceAllowedForPhase({
        source: "gemini_file_api",
        phase: "manual_real_test",
      }),
    ).toBe(true);
  });

  it("manual_real_test permite inline_base64", () => {
    expect(
      isVideoNarrativeInputSourceAllowedForPhase({
        source: "inline_base64",
        phase: "manual_real_test",
      }),
    ).toBe(true);
  });

  it("manual_real_test bloqueia temporary_storage", () => {
    expect(
      isVideoNarrativeInputSourceAllowedForPhase({
        source: "temporary_storage",
        phase: "manual_real_test",
      }),
    ).toBe(false);
  });

  it("internal_endpoint permite gemini_file_api", () => {
    expect(
      isVideoNarrativeInputSourceAllowedForPhase({
        source: "gemini_file_api",
        phase: "internal_endpoint",
      }),
    ).toBe(true);
  });

  it.each<VideoNarrativeInputSource>(["temporary_storage", "gcs", "s3", "r2"])(
    "internal_endpoint permite %s",
    (source) => {
      expect(isVideoNarrativeInputSourceAllowedForPhase({ source, phase: "internal_endpoint" })).toBe(true);
    },
  );

  it("closed_beta bloqueia gemini_file_api e inline_base64", () => {
    expect(isVideoNarrativeInputSourceAllowedForPhase({ source: "gemini_file_api", phase: "closed_beta" })).toBe(
      false,
    );
    expect(isVideoNarrativeInputSourceAllowedForPhase({ source: "inline_base64", phase: "closed_beta" })).toBe(
      false,
    );
  });

  it("production bloqueia gemini_file_api e inline_base64", () => {
    expect(isVideoNarrativeInputSourceAllowedForPhase({ source: "gemini_file_api", phase: "production" })).toBe(
      false,
    );
    expect(isVideoNarrativeInputSourceAllowedForPhase({ source: "inline_base64", phase: "production" })).toBe(
      false,
    );
  });

  it.each<VideoNarrativeInputSourcePhase>([
    "manual_real_test",
    "internal_endpoint",
    "closed_beta",
    "production",
  ])("public_url_restricted bloqueia em %s", (phase) => {
    expect(
      validateVideoNarrativeInputSourceForPhase({
        payload: buildPayload({
          source: "public_url_restricted",
          videoUri: "https://example.test/video.mp4",
        }),
        phase,
      }).issues.map((issue) => issue.code),
    ).toContain("public_url_not_allowed");
  });

  it("requiresVideoNarrativeVideoUri retorna true para sources remotos", () => {
    (["gemini_file_api", "temporary_storage", "gcs", "s3", "r2", "public_url_restricted"] as const).forEach(
      (source) => {
        expect(requiresVideoNarrativeVideoUri(source)).toBe(true);
      },
    );
    expect(requiresVideoNarrativeVideoUri("inline_base64")).toBe(false);
  });

  it("requiresVideoNarrativeInlinePayload retorna true só para inline_base64", () => {
    (["gemini_file_api", "temporary_storage", "gcs", "s3", "r2", "public_url_restricted"] as const).forEach(
      (source) => {
        expect(requiresVideoNarrativeInlinePayload(source)).toBe(false);
      },
    );
    expect(requiresVideoNarrativeInlinePayload("inline_base64")).toBe(true);
  });

  it("requiresVideoNarrativeMimeTypeForSource retorna true para inline_base64", () => {
    expect(requiresVideoNarrativeMimeTypeForSource("inline_base64")).toBe(true);
    expect(requiresVideoNarrativeMimeTypeForSource("gemini_file_api")).toBe(false);
  });

  it("passa para gemini_file_api com videoUri em manual_real_test", () => {
    const result = validateVideoNarrativeInputSourceForPhase({
      payload: buildPayload({ source: "gemini_file_api", videoUri: "file-uri" }),
      phase: "manual_real_test",
    });

    expect(result.ok).toBe(true);
    expect(result.guardResult.status).toBe("passed");
  });

  it("passa para inline_base64 com mimeType e payload pequeno em manual_real_test", () => {
    const result = validateVideoNarrativeInputSourceForPhase({
      payload: buildPayload({
        source: "inline_base64",
        videoUri: null,
        inlineVideoBase64: "abcd1234",
        mimeType: "video/mp4",
      }),
      phase: "manual_real_test",
    });

    expect(result.ok).toBe(true);
  });

  it("bloqueia inline_base64 em production", () => {
    expect(
      codesFor({
        payload: buildPayload({
          source: "inline_base64",
          videoUri: null,
          inlineVideoBase64: "abcd1234",
          mimeType: "video/mp4",
        }),
        phase: "production",
      }),
    ).toContain("source_not_allowed_for_phase");
  });

  it("bloqueia source remoto sem videoUri", () => {
    expect(
      codesFor({
        payload: buildPayload({ source: "gcs", videoUri: null }),
        phase: "internal_endpoint",
      }),
    ).toContain("missing_video_uri_for_source");
  });

  it("bloqueia inline sem mimeType", () => {
    expect(
      codesFor({
        payload: buildPayload({
          source: "inline_base64",
          videoUri: null,
          inlineVideoBase64: "abcd1234",
          mimeType: null,
        }),
        phase: "manual_real_test",
      }),
    ).toContain("missing_mime_type_for_inline");
  });

  it("bloqueia inline acima do limite da fase", () => {
    expect(
      codesFor({
        payload: buildPayload({
          source: "inline_base64",
          videoUri: null,
          inlineVideoBase64: "a".repeat(VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST + 1),
          mimeType: "video/mp4",
        }),
        phase: "manual_real_test",
      }),
    ).toContain("inline_base64_too_large_for_phase");
  });

  it("bloqueia source/payload mismatch", () => {
    expect(
      codesFor({
        payload: buildPayload({
          source: "gcs",
          videoUri: "gcs-uri",
          inlineVideoBase64: "abcd1234",
        }),
        phase: "internal_endpoint",
      }),
    ).toContain("source_payload_mismatch");

    expect(
      codesFor({
        payload: buildPayload({
          source: "inline_base64",
          videoUri: "file-uri",
          inlineVideoBase64: "abcd1234",
          mimeType: "video/mp4",
        }),
        phase: "manual_real_test",
      }),
    ).toContain("source_payload_mismatch");
  });

  it("buildVideoNarrativeInputSourceGuardResult cria passed guard quando ok", () => {
    expect(
      buildVideoNarrativeInputSourceGuardResult({
        ok: true,
        source: "gemini_file_api",
        phase: "manual_real_test",
      }).guardResult,
    ).toMatchObject({
      name: "input_source",
      status: "passed",
      code: null,
      shouldCallProvider: true,
    });
  });

  it("buildVideoNarrativeInputSourceGuardResult cria blocked guard quando inválido", () => {
    expect(
      buildVideoNarrativeInputSourceGuardResult({
        ok: false,
        source: "temporary_storage",
        phase: "manual_real_test",
        issues: [{ code: "source_not_allowed_for_phase", message: "Origem não habilitada." }],
      }).guardResult,
    ).toMatchObject({
      name: "input_source",
      status: "blocked",
      code: "invalid_source",
      shouldCallProvider: false,
      shouldConsumeQuota: false,
    });
  });

  it("mensagens não incluem base64 mesmo quando payload tem base64 longo", () => {
    const result = validateVideoNarrativeInputSourceForPhase({
      payload: buildPayload({
        source: "inline_base64",
        videoUri: null,
        inlineVideoBase64: "a".repeat(VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST + 1),
        mimeType: "video/mp4",
      }),
      phase: "manual_real_test",
    });

    const text = result.issues.map((issue) => issue.message).join(" ");
    expect(text).not.toContain("a".repeat(120));
    expect(text).toContain("Vídeo inline acima do limite desta fase.");
  });

  it("mantém linguagem segura em mensagens e defaults", () => {
    const outputs = [
      buildVideoNarrativeInputSourceGuardResult({
        ok: false,
        source: "temporary_storage",
        phase: "manual_real_test",
        issues: [{ code: "source_not_allowed_for_phase", message: "Origem não habilitada." }],
      }).guardResult.message,
      validateVideoNarrativeInputSourceForPhase({
        payload: buildPayload({
          source: "inline_base64",
          videoUri: null,
          inlineVideoBase64: "a".repeat(VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST + 1),
          mimeType: "video/mp4",
        }),
        phase: "manual_real_test",
      }).issues.map((issue) => issue.message),
    ]
      .flat()
      .join(" ")
      .toLowerCase();

    [
      "garantido",
      "certeza",
      "comprovado",
      "viralizar garantido",
      "score",
      "nota",
      "pontuação",
      "acerto",
      "gabarito",
      "resposta correta",
      "venceu",
      "perdeu",
      "treinado permanentemente",
    ].forEach((term) => {
      expect(outputs).not.toMatch(new RegExp(`(^|\\W)${term.replace(/\s+/g, "\\s+")}(\\W|$)`, "i"));
    });
  });

  it("mantém o contrato puro sem imports proibidos", () => {
    const source = fs.readFileSync(CONTRACT_SOURCE_PATH, "utf8");
    const forbiddenImports = [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch",
      "Prisma",
      "banco",
      "componentes",
      "hooks",
      "endpoint",
      "upload service",
      "storage provider",
      "analytics provider",
      "ffmpeg",
      "UI",
      "Stripe",
      "billing",
      "@google/genai",
    ];

    forbiddenImports.forEach((term) => {
      expect(source).not.toContain(`from "${term}`);
      expect(source).not.toContain(`from '${term}`);
    });
  });

  it("confirma que a rota futura ainda não existe", () => {
    const routePath = path.join(
      process.cwd(),
      "src/app/api/internal/video-narrative/analyze/route.ts",
    );

    expect(fs.existsSync(routePath)).toBe(false);
  });
});
