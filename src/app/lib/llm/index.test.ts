// src/app/lib/llm/index.test.ts

import {
  llmGenerate,
  llmGenerateJSON,
  resolveProviderOrder,
} from "./index";
import { openaiProvider } from "./openaiProvider";
import { geminiProvider } from "./geminiProvider";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Providers mockados — evita SDKs reais e permite exercitar seleção/fallback.
jest.mock("./openaiProvider", () => ({
  openaiProvider: { name: "openai", available: jest.fn(() => true), generate: jest.fn() },
}));
jest.mock("./geminiProvider", () => ({
  geminiProvider: { name: "gemini", available: jest.fn(() => true), generate: jest.fn() },
}));

const mockOpenai = openaiProvider as jest.Mocked<typeof openaiProvider>;
const mockGemini = geminiProvider as jest.Mocked<typeof geminiProvider>;

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  jest.clearAllMocks();
  process.env = { ...ORIGINAL_ENV };
  (mockOpenai.available as jest.Mock).mockReturnValue(true);
  (mockGemini.available as jest.Mock).mockReturnValue(true);
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("resolveProviderOrder", () => {
  it("default: openai primário", () => {
    delete process.env.LLM_PROVIDER;
    delete process.env.LLM_PROVIDER_MAPA;
    expect(resolveProviderOrder("MAPA")).toEqual(["openai", "gemini"]);
  });

  it("LLM_PROVIDER_MAPA=gemini → gemini primário", () => {
    process.env.LLM_PROVIDER_MAPA = "gemini";
    expect(resolveProviderOrder("MAPA")).toEqual(["gemini", "openai"]);
  });

  it("LLM_PROVIDER global é fallback do escopo", () => {
    delete process.env.LLM_PROVIDER_MAPA;
    process.env.LLM_PROVIDER = "gemini";
    expect(resolveProviderOrder("MAPA")).toEqual(["gemini", "openai"]);
  });

  it("escopo específico tem precedência sobre o global", () => {
    process.env.LLM_PROVIDER = "gemini";
    process.env.LLM_PROVIDER_MAPA = "openai";
    expect(resolveProviderOrder("MAPA")).toEqual(["openai", "gemini"]);
  });
});

describe("llmGenerate — short-circuit de teste", () => {
  it("texto: stub vazio em NODE_ENV=test", async () => {
    const r = await llmGenerate({ prompt: "x" });
    expect(r.text).toBe("");
    expect(mockOpenai.generate).not.toHaveBeenCalled();
    expect(mockGemini.generate).not.toHaveBeenCalled();
  });

  it("json: stub '{}' em NODE_ENV=test", async () => {
    const r = await llmGenerate({ prompt: "x", json: true });
    expect(r.text).toBe("{}");
  });

  it("llmGenerateJSON faz parse do stub", async () => {
    await expect(llmGenerateJSON({ prompt: "x" })).resolves.toEqual({});
  });
});

describe("llmGenerate — seleção e fallback (fora de teste)", () => {
  beforeEach(() => {
    (process.env as Record<string, string>).NODE_ENV = "development";
  });

  it("usa o primário quando disponível", async () => {
    process.env.LLM_PROVIDER_MAPA = "gemini";
    (mockGemini.generate as jest.Mock).mockResolvedValue({ text: "ok", provider: "gemini", model: "flash" });

    const r = await llmGenerate({ prompt: "x" }, { scope: "MAPA" });

    expect(r.provider).toBe("gemini");
    expect(mockGemini.generate).toHaveBeenCalledTimes(1);
    expect(mockOpenai.generate).not.toHaveBeenCalled();
  });

  it("cai no fallback quando o primário falha", async () => {
    process.env.LLM_PROVIDER_MAPA = "gemini";
    (mockGemini.generate as jest.Mock).mockRejectedValue(new Error("down"));
    (mockOpenai.generate as jest.Mock).mockResolvedValue({ text: "ok", provider: "openai", model: "gpt-4o" });

    const r = await llmGenerate({ prompt: "x" }, { scope: "MAPA" });

    expect(r.provider).toBe("openai");
    expect(mockGemini.generate).toHaveBeenCalledTimes(1);
    expect(mockOpenai.generate).toHaveBeenCalledTimes(1);
  });

  it("pula provider indisponível sem tentar gerar", async () => {
    process.env.LLM_PROVIDER_MAPA = "gemini";
    (mockGemini.available as jest.Mock).mockReturnValue(false);
    (mockOpenai.generate as jest.Mock).mockResolvedValue({ text: "ok", provider: "openai", model: "gpt-4o" });

    const r = await llmGenerate({ prompt: "x" }, { scope: "MAPA" });

    expect(r.provider).toBe("openai");
    expect(mockGemini.generate).not.toHaveBeenCalled();
  });

  it("lança quando nenhum provider está disponível", async () => {
    (mockGemini.available as jest.Mock).mockReturnValue(false);
    (mockOpenai.available as jest.Mock).mockReturnValue(false);

    await expect(llmGenerate({ prompt: "x" }, { scope: "MAPA" })).rejects.toThrow();
  });
});
