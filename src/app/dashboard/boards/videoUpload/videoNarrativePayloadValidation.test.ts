import fs from "fs";
import path from "path";

import {
  VIDEO_NARRATIVE_ALLOWED_MIME_TYPES,
  VIDEO_NARRATIVE_ALLOWED_SOURCES,
  VIDEO_NARRATIVE_MAX_CREATOR_QUESTION_LENGTH,
  VIDEO_NARRATIVE_MAX_ID_LENGTH,
  VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST,
  VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVE_LENGTH,
  VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVES,
  isAllowedVideoNarrativeInputSource,
  isAllowedVideoNarrativeMimeType,
  sanitizeVideoNarrativePayloadText,
  validateVideoNarrativeAnalyzePayload,
} from "./videoNarrativePayloadValidation";

const VIDEO_UPLOAD_DIR = __dirname;
const CONTRACT_SOURCE_PATH = path.join(VIDEO_UPLOAD_DIR, "videoNarrativePayloadValidation.ts");

function issueCodes(payload: unknown): string[] {
  return validateVideoNarrativeAnalyzePayload(payload).issues.map((issue) => issue.code);
}

describe("videoNarrativePayloadValidation", () => {
  it("retorna missing_payload e guard blocked para payload não objeto", () => {
    const result = validateVideoNarrativeAnalyzePayload(null);

    expect(result.ok).toBe(false);
    expect(result.normalized).toBeNull();
    expect(result.issues).toEqual([
      {
        code: "missing_payload",
        message: "Payload não validado.",
        guardCode: "invalid_payload",
      },
    ]);
    expect(result.guardResult).toMatchObject({
      name: "payload_schema",
      status: "blocked",
      code: "invalid_payload",
      shouldCallProvider: false,
      shouldConsumeQuota: false,
    });
  });

  it("valida payload mínimo com videoUri e source gemini_file_api", () => {
    const result = validateVideoNarrativeAnalyzePayload({
      videoUri: "file-uri",
      source: "gemini_file_api",
    });

    expect(result.ok).toBe(true);
    expect(result.normalized).toMatchObject({
      id: "manual-video-narrative-run",
      videoUri: "file-uri",
      inlineVideoBase64: null,
      mimeType: null,
      source: "gemini_file_api",
    });
  });

  it("valida payload mínimo com inlineVideoBase64, mimeType e source inline_base64", () => {
    const result = validateVideoNarrativeAnalyzePayload({
      inlineVideoBase64: "abcd1234",
      mimeType: "video/mp4",
      source: "inline_base64",
    });

    expect(result.ok).toBe(true);
    expect(result.normalized).toMatchObject({
      videoUri: null,
      inlineVideoBase64: "abcd1234",
      mimeType: "video/mp4",
      source: "inline_base64",
    });
  });

  it("retorna missing_video_input quando não há vídeo", () => {
    expect(issueCodes({ source: "gemini_file_api" })).toContain("missing_video_input");
  });

  it("retorna conflicting_video_input quando videoUri e inlineVideoBase64 vêm juntos", () => {
    expect(
      issueCodes({
        videoUri: "file-uri",
        inlineVideoBase64: "abcd1234",
        mimeType: "video/mp4",
        source: "inline_base64",
      }),
    ).toContain("conflicting_video_input");
  });

  it("retorna inline_base64_too_large quando inline passa do limite", () => {
    expect(
      issueCodes({
        inlineVideoBase64: "a".repeat(VIDEO_NARRATIVE_MAX_INLINE_BASE64_LENGTH_FOR_INTERNAL_TEST + 1),
        mimeType: "video/mp4",
        source: "inline_base64",
      }),
    ).toContain("inline_base64_too_large");
  });

  it("retorna missing_mime_type quando inline não informa mimeType", () => {
    expect(issueCodes({ inlineVideoBase64: "abcd1234", source: "inline_base64" })).toContain(
      "missing_mime_type",
    );
  });

  it("retorna invalid_mime_type para mimeType inválido", () => {
    expect(
      issueCodes({
        inlineVideoBase64: "abcd1234",
        mimeType: "video/avi",
        source: "inline_base64",
      }),
    ).toContain("invalid_mime_type");
  });

  it("retorna invalid_source quando source está ausente", () => {
    expect(issueCodes({ videoUri: "file-uri" })).toContain("invalid_source");
  });

  it("retorna invalid_source quando source é desconhecido", () => {
    expect(issueCodes({ videoUri: "file-uri", source: "unknown" })).toContain("invalid_source");
  });

  it("bloqueia public_url_restricted por padrão", () => {
    expect(issueCodes({ videoUri: "https://example.test/video.mp4", source: "public_url_restricted" })).toContain(
      "source_not_allowed",
    );
  });

  it("retorna missing_video_input para source inline_base64 sem inlineVideoBase64", () => {
    expect(issueCodes({ source: "inline_base64" })).toContain("missing_video_input");
  });

  it("retorna missing_video_input para source gemini_file_api sem videoUri", () => {
    expect(issueCodes({ source: "gemini_file_api" })).toContain("missing_video_input");
  });

  it("usa id default quando id está ausente", () => {
    const result = validateVideoNarrativeAnalyzePayload({
      videoUri: "file-uri",
      source: "gemini_file_api",
    });

    expect(result.normalized?.id).toBe("manual-video-narrative-run");
  });

  it("retorna invalid_id quando id passa do limite", () => {
    expect(
      issueCodes({
        id: "a".repeat(VIDEO_NARRATIVE_MAX_ID_LENGTH + 1),
        videoUri: "file-uri",
        source: "gemini_file_api",
      }),
    ).toContain("invalid_id");
  });

  it("trima creatorQuestion string", () => {
    const result = validateVideoNarrativeAnalyzePayload({
      creatorQuestion: "  Quero saber se vale postar  ",
      videoUri: "file-uri",
      source: "gemini_file_api",
    });

    expect(result.normalized?.creatorQuestion).toBe("Quero saber se vale postar");
  });

  it("retorna invalid_creator_question quando creatorQuestion passa do limite", () => {
    expect(
      issueCodes({
        creatorQuestion: "a".repeat(VIDEO_NARRATIVE_MAX_CREATOR_QUESTION_LENGTH + 1),
        videoUri: "file-uri",
        source: "gemini_file_api",
      }),
    ).toContain("invalid_creator_question");
  });

  it("redige API key dentro de creatorQuestion", () => {
    const result = validateVideoNarrativeAnalyzePayload({
      creatorQuestion: "usar GEMINI_API_KEY=secret",
      videoUri: "file-uri",
      source: "gemini_file_api",
    });

    expect(result.normalized?.creatorQuestion).toBe("usar [redigido]");
  });

  it("normaliza creatorContext válido", () => {
    const result = validateVideoNarrativeAnalyzePayload({
      videoUri: "file-uri",
      source: "gemini_file_api",
      creatorContext: {
        handle: "  @criador  ",
        niche: "  beleza  ",
        knownNarratives: [" rotina ", "", " transformação "],
      },
    });

    expect(result.ok).toBe(true);
    expect(result.normalized?.creatorContext).toEqual({
      handle: "@criador",
      niche: "beleza",
      knownNarratives: ["rotina", "transformação"],
    });
  });

  it("retorna invalid_creator_context para creatorContext inválido", () => {
    expect(
      issueCodes({
        videoUri: "file-uri",
        source: "gemini_file_api",
        creatorContext: "contexto",
      }),
    ).toContain("invalid_creator_context");
  });

  it("retorna creator_context_too_large quando knownNarratives passa do limite", () => {
    expect(
      issueCodes({
        videoUri: "file-uri",
        source: "gemini_file_api",
        creatorContext: {
          knownNarratives: Array.from({ length: VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVES + 1 }, (_, index) =>
            `narrativa ${index}`,
          ),
        },
      }),
    ).toContain("creator_context_too_large");
  });

  it("remove knownNarratives vazias e corta texto longo", () => {
    const longNarrative = Array.from({ length: 40 }, () => "narrativa").join(" ");
    const result = validateVideoNarrativeAnalyzePayload({
      videoUri: "file-uri",
      source: "gemini_file_api",
      creatorContext: {
        knownNarratives: ["", "   ", longNarrative],
      },
    });

    expect(result.normalized?.creatorContext?.knownNarratives).toEqual([
      longNarrative.slice(0, VIDEO_NARRATIVE_MAX_KNOWN_NARRATIVE_LENGTH).trim(),
    ]);
  });

  it("retorna guardResult passed quando ok", () => {
    const result = validateVideoNarrativeAnalyzePayload({
      videoUri: "file-uri",
      source: "gemini_file_api",
    });

    expect(result.guardResult).toMatchObject({
      name: "payload_schema",
      status: "passed",
      code: null,
      shouldCallProvider: true,
    });
  });

  it("retorna guardResult blocked quando inválido", () => {
    const result = validateVideoNarrativeAnalyzePayload({});

    expect(result.guardResult).toMatchObject({
      name: "payload_schema",
      status: "blocked",
      code: "invalid_payload",
      shouldCallProvider: false,
      shouldConsumeQuota: false,
    });
  });

  it("isAllowedVideoNarrativeInputSource cobre todos os sources permitidos", () => {
    VIDEO_NARRATIVE_ALLOWED_SOURCES.forEach((source) => {
      expect(isAllowedVideoNarrativeInputSource(source)).toBe(true);
    });
    expect(isAllowedVideoNarrativeInputSource("source_desconhecida")).toBe(false);
  });

  it("isAllowedVideoNarrativeMimeType cobre todos os mimeTypes permitidos", () => {
    VIDEO_NARRATIVE_ALLOWED_MIME_TYPES.forEach((mimeType) => {
      expect(isAllowedVideoNarrativeMimeType(mimeType)).toBe(true);
    });
    expect(isAllowedVideoNarrativeMimeType("video/avi")).toBe(false);
  });

  it("redige AIza, GEMINI_API_KEY e GOOGLE_GENAI_API_KEY", () => {
    expect(
      sanitizeVideoNarrativePayloadText(
        "AIza1234567890abcdefghi GEMINI_API_KEY=abc GOOGLE_GENAI_API_KEY=def",
      ),
    ).toBe("[redigido] [redigido] [redigido]");
  });

  it("redige base64 longo", () => {
    expect(sanitizeVideoNarrativePayloadText(`payload ${"a".repeat(140)}`)).toBe("payload [redigido]");
  });

  it("mantém linguagem segura em mensagens e defaults", () => {
    const outputs = [
      validateVideoNarrativeAnalyzePayload(null).issues.map((issue) => issue.message),
      validateVideoNarrativeAnalyzePayload({}).issues.map((issue) => issue.message),
      sanitizeVideoNarrativePayloadText(
        "garantido certeza comprovado viralizar garantido score nota pontuação acerto gabarito resposta correta venceu perdeu treinado permanentemente",
      ),
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
