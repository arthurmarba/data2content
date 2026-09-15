/** @jest-environment node */
import { geminiProvider, THINKING_HEADROOM_BY_LEVEL } from "./geminiProvider";
import { logger } from "@/app/lib/logger";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("./geminiUsageLog", () => ({ logGeminiUsage: jest.fn() }));

const mockGenerateContent = jest.fn();
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(() => ({ models: { generateContent: (...args: unknown[]) => mockGenerateContent(...args) } })),
  ThinkingLevel: { LOW: "LOW", MEDIUM: "MEDIUM", HIGH: "HIGH" },
  createUserContent: jest.fn((parts) => ({ role: "user", parts })),
}));

const ORIGINAL_ENV = { ...process.env };
const config = () => mockGenerateContent.mock.calls[0][0].config;

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV, GEMINI_API_KEY: "teste" };
  delete process.env.GOOGLE_GEMINI_API_KEY;
  delete process.env.GEMINI_MODEL;
  delete process.env.GEMINI_MAPA_MODEL;
  delete process.env.GEMINI_THINKING_LEVEL;
  mockGenerateContent.mockResolvedValue({ text: "{}", candidates: [{ finishReason: "STOP" }] });
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("geminiProvider — teto de resposta com raciocínio", () => {
  it("Gemini 3 soma a folga do raciocínio ao teto pedido", async () => {
    await geminiProvider.generate({ prompt: "x", intensity: "high", maxTokens: 1024 });
    expect(config().thinkingConfig).toEqual({ thinkingLevel: "MEDIUM" });
    expect(config().maxOutputTokens).toBe(1024 + THINKING_HEADROOM_BY_LEVEL.medium);
  });

  it("Gemini 3 sem teto explícito usa o padrão da intensidade mais a folga", async () => {
    await geminiProvider.generate({ prompt: "x", intensity: "low" });
    expect(config().maxOutputTokens).toBe(1024 + THINKING_HEADROOM_BY_LEVEL.low);
  });

  it("Gemini 2.5 com raciocínio desligado mantém o teto exato", async () => {
    await geminiProvider.generate({ prompt: "x", intensity: "low", maxTokens: 2048, model: "gemini-2.5-flash-lite" });
    expect(config().maxOutputTokens).toBe(2048);
  });

  it("avisa no log quando a resposta sai cortada", async () => {
    mockGenerateContent.mockResolvedValue({ text: "{", candidates: [{ finishReason: "MAX_TOKENS" }] });
    await geminiProvider.generate({ prompt: "x", usageTag: "mapa_instagram" });
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining("resposta cortada"));
  });
});
