import fs from "fs";
import path from "path";

import {
  GoogleGenAI,
  createPartFromBase64,
  createPartFromUri,
  createUserContent,
} from "@google/genai";
import {
  DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL,
  GEMINI_INLINE_VIDEO_BYTES_LIMIT,
  createGeminiVideoNarrativeClient,
  createVideoNarrativeGeminiClientAdapter,
} from "./geminiVideoNarrativeClientFactory";

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(),
  createUserContent: jest.fn((parts) => ({ role: "user", parts })),
  createPartFromUri: jest.fn((uri, mimeType) => ({ fileData: { fileUri: uri, mimeType } })),
  createPartFromBase64: jest.fn((data, mimeType) => ({ inlineData: { data, mimeType } })),
}));

const generateContent = jest.fn();
const uploadFile = jest.fn();
const getFile = jest.fn();
const deleteFile = jest.fn();
const mockedGoogleGenAI = GoogleGenAI as jest.MockedClass<typeof GoogleGenAI>;
const mockedCreateUserContent = createUserContent as jest.MockedFunction<typeof createUserContent>;
const mockedCreatePartFromUri = createPartFromUri as jest.MockedFunction<typeof createPartFromUri>;
const mockedCreatePartFromBase64 = createPartFromBase64 as jest.MockedFunction<typeof createPartFromBase64>;

const forbiddenTerms = [
  "erro",
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
];

function buildClient(model?: string) {
  return createGeminiVideoNarrativeClient({
    apiKey: "secret-key",
    model,
  }).client!;
}

beforeEach(() => {
  jest.clearAllMocks();
  generateContent.mockResolvedValue({ text: "texto útil" });
  uploadFile.mockResolvedValue({
    name: "files/video-real",
    uri: "https://generativelanguage.googleapis.com/v1beta/files/video-real",
    mimeType: "video/mp4",
    state: "ACTIVE",
  });
  getFile.mockResolvedValue({
    name: "files/video-real",
    uri: "https://generativelanguage.googleapis.com/v1beta/files/video-real",
    mimeType: "video/mp4",
    state: "ACTIVE",
  });
  deleteFile.mockResolvedValue({});
  mockedGoogleGenAI.mockImplementation(
    () =>
      ({
        models: { generateContent },
        files: {
          upload: uploadFile,
          get: getFile,
          delete: deleteFile,
        },
      }) as unknown as GoogleGenAI,
  );
});

describe("geminiVideoNarrativeClientFactory", () => {
  it("returns false without apiKey", () => {
    expect(createGeminiVideoNarrativeClient({ apiKey: "" })).toEqual({
      ok: false,
      client: null,
      issue: "Chave do provider multimodal ausente.",
    });
  });

  it("returns true with apiKey", () => {
    expect(createGeminiVideoNarrativeClient({ apiKey: "secret-key" })).toMatchObject({
      ok: true,
      issue: null,
    });
  });

  it("creates a client with generateContent", () => {
    expect(buildClient().generateContent).toEqual(expect.any(Function));
  });

  it("uses uri parts when videoUri is provided", async () => {
    const client = buildClient();
    await client.generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseFormatInstruction: "json",
      videoUri: "gs://bucket/video.mp4",
      mimeType: "video/mp4",
    });

    expect(mockedCreatePartFromUri).toHaveBeenCalledWith("gs://bucket/video.mp4", "video/mp4");
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.objectContaining({
          parts: expect.arrayContaining([{ fileData: { fileUri: "gs://bucket/video.mp4", mimeType: "video/mp4" } }]),
        }),
      }),
    );
  });

  it("mantém MIME QuickTime do browser no formato aceito pelo Gemini", async () => {
    const client = buildClient();
    await client.generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseFormatInstruction: "json",
      videoUri: "gs://bucket/video.mov",
      mimeType: "video/quicktime",
    });

    expect(mockedCreatePartFromUri).toHaveBeenCalledWith("gs://bucket/video.mov", "video/quicktime");
  });

  it("uses inline data when inlineVideoBase64 is provided", async () => {
    const client = buildClient();
    await client.generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseFormatInstruction: "json",
      inlineVideoBase64: "ZmFrZQ==",
      mimeType: "video/mp4",
    });

    expect(mockedCreatePartFromBase64).toHaveBeenCalledWith("ZmFrZQ==", "video/mp4");
    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        contents: expect.objectContaining({
          parts: expect.arrayContaining([{ inlineData: { data: "ZmFrZQ==", mimeType: "video/mp4" } }]),
        }),
      }),
    );
  });

  it("returns text from the sdk response", async () => {
    generateContent.mockResolvedValueOnce({ text: "resposta" });
    const result = await buildClient().generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseFormatInstruction: "json",
      videoUri: "gs://bucket/video.mp4",
    });

    expect(result).toEqual({ text: "resposta" });
  });

  it("returns null when the sdk response has no text", async () => {
    generateContent.mockResolvedValueOnce({});
    const result = await buildClient().generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseFormatInstruction: "json",
      videoUri: "gs://bucket/video.mp4",
    });

    expect(result).toEqual({ text: null });
  });

  it("returns null without media and does not call the model", async () => {
    const result = await buildClient().generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseFormatInstruction: "json",
    });

    expect(result).toEqual({ text: null });
    expect(generateContent).not.toHaveBeenCalled();
  });

  it("uses the default model", async () => {
    await buildClient().generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseFormatInstruction: "json",
      videoUri: "gs://bucket/video.mp4",
    });

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({ model: DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL }),
    );
  });

  it("respects a custom model", async () => {
    await buildClient("gemini-custom").generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseFormatInstruction: "json",
      videoUri: "gs://bucket/video.mp4",
    });

    expect(generateContent).toHaveBeenCalledWith(expect.objectContaining({ model: "gemini-custom" }));
  });

  it("adapter server-side pede JSON nativo sem schema complexo incompatível com o Gemini", async () => {
    const client = createVideoNarrativeGeminiClientAdapter({
      apiKey: "secret-key",
      model: "gemini-custom",
    }).client!;

    await client.generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseSchemaInstruction: "json",
      model: "gemini-runtime",
      maxOutputTokens: 3000,
      videoInput: {
        mimeType: "video/mp4",
        bytes: Buffer.from("fake-video"),
        source: "temporary_storage",
      },
    });

    expect(generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: "gemini-runtime",
        config: expect.objectContaining({
          responseMimeType: "application/json",
          maxOutputTokens: 3000,
          systemInstruction: "sistema",
        }),
      }),
    );
    expect(generateContent.mock.calls[0][0].config).not.toHaveProperty("responseJsonSchema");
  });

  it("adapter server-side usa File API para vídeo grande em vez de inline base64", async () => {
    uploadFile.mockResolvedValueOnce({
      name: "files/video-real",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/video-real",
      mimeType: "video/quicktime",
      state: "ACTIVE",
    });
    const client = createVideoNarrativeGeminiClientAdapter({
      apiKey: "secret-key",
      model: "gemini-custom",
    }).client!;

    await client.generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseSchemaInstruction: "json",
      model: "gemini-runtime",
      maxOutputTokens: 3000,
      videoInput: {
        mimeType: "video/quicktime",
        bytes: Buffer.alloc(GEMINI_INLINE_VIDEO_BYTES_LIMIT + 1, 1),
        source: "temporary_storage",
      },
    });

    expect(uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        file: expect.stringMatching(/d2c-gemini-video-.+\.mov$/),
        config: { mimeType: "video/quicktime" },
      }),
    );
    expect(mockedCreatePartFromBase64).not.toHaveBeenCalled();
    expect(mockedCreatePartFromUri).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/files/video-real",
      "video/quicktime",
    );
    expect(deleteFile).toHaveBeenCalledWith({ name: "files/video-real" });
  });

  it("adapter server-side classifica bloqueio de permissão da File API", async () => {
    const permissionError = Object.assign(
      new Error('{"error":{"status":"PERMISSION_DENIED","message":"Lightning dunning decision is deny"}}'),
      { status: 403 },
    );
    uploadFile.mockRejectedValueOnce(permissionError);
    const client = createVideoNarrativeGeminiClientAdapter({
      apiKey: "secret-key",
      model: "gemini-custom",
    }).client!;

    await expect(
      client.generateContent({
        systemInstruction: "sistema",
        userInstruction: "usuário",
        responseSchemaInstruction: "json",
        model: "gemini-runtime",
        maxOutputTokens: 3000,
        videoInput: {
          mimeType: "video/quicktime",
          bytes: Buffer.alloc(GEMINI_INLINE_VIDEO_BYTES_LIMIT + 1, 1),
          source: "temporary_storage",
        },
      }),
    ).rejects.toThrow("gemini_file_permission_denied");

    expect(deleteFile).not.toHaveBeenCalled();
  });

  it("adapter server-side aguarda vídeo enviado ficar ativo antes de chamar modelo", async () => {
    uploadFile.mockResolvedValueOnce({
      name: "files/video-processing",
      mimeType: "video/mp4",
      state: "PROCESSING",
    });
    getFile.mockResolvedValueOnce({
      name: "files/video-processing",
      uri: "https://generativelanguage.googleapis.com/v1beta/files/video-processing",
      mimeType: "video/mp4",
      state: "ACTIVE",
    });
    const client = createVideoNarrativeGeminiClientAdapter({
      apiKey: "secret-key",
      model: "gemini-custom",
    }).client!;

    await client.generateContent({
      systemInstruction: "sistema",
      userInstruction: "usuário",
      responseSchemaInstruction: "json",
      model: "gemini-runtime",
      maxOutputTokens: 3000,
      videoInput: {
        mimeType: "video/mp4",
        bytes: Buffer.alloc(GEMINI_INLINE_VIDEO_BYTES_LIMIT + 1, 1),
        source: "temporary_storage",
      },
    });

    expect(getFile).toHaveBeenCalledWith({ name: "files/video-processing" });
    expect(mockedCreatePartFromUri).toHaveBeenCalledWith(
      "https://generativelanguage.googleapis.com/v1beta/files/video-processing",
      "video/mp4",
    );
  });

  it("does not expose the api key in issues or generated text", () => {
    const missing = createGeminiVideoNarrativeClient({ apiKey: "" });
    const ready = createGeminiVideoNarrativeClient({ apiKey: "secret-key" });
    const content = JSON.stringify({ missing, ready });

    expect(content).not.toContain("secret-key");
  });

  it("keeps exported strings free of blocked language", () => {
    const content = JSON.stringify({
      issue: createGeminiVideoNarrativeClient({ apiKey: "" }).issue,
      model: DEFAULT_GEMINI_VIDEO_NARRATIVE_MODEL,
    }).toLowerCase();

    forbiddenTerms.forEach((term) => expect(content).not.toContain(term));
  });

  it("keeps factory imports isolated from forbidden integrations", () => {
    const source = fs.readFileSync(path.join(__dirname, "geminiVideoNarrativeClientFactory.ts"), "utf8");
    [
      "React",
      "BoardShell",
      "PostCreationFunnelBoardShell",
      "OpenAI",
      "fetch(",
      "Prisma",
      "banco",
      "components/",
      "hooks/",
      "endpoint",
      "upload service",
      "storage provider",
      "ffmpeg",
    ].forEach((blocked) => expect(source).not.toContain(blocked));
  });
});
