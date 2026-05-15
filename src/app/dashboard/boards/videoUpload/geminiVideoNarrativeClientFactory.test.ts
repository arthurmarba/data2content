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
  createGeminiVideoNarrativeClient,
} from "./geminiVideoNarrativeClientFactory";

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(),
  createUserContent: jest.fn((parts) => ({ role: "user", parts })),
  createPartFromUri: jest.fn((uri, mimeType) => ({ fileData: { fileUri: uri, mimeType } })),
  createPartFromBase64: jest.fn((data, mimeType) => ({ inlineData: { data, mimeType } })),
}));

const generateContent = jest.fn();
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
  mockedGoogleGenAI.mockImplementation(
    () =>
      ({
        models: { generateContent },
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
