import { classifyContentWithAi } from "./classificationAiProvider";
import { getCachedClassification, setCachedClassification } from "./classificationCache";
import { llmGenerate } from "./llm";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("./classificationCache", () => ({
  getCachedClassification: jest.fn(),
  setCachedClassification: jest.fn(),
}));
jest.mock("./llm", () => ({ llmGenerate: jest.fn() }));

const cached = getCachedClassification as jest.MockedFunction<typeof getCachedClassification>;
const saveCache = setCachedClassification as jest.MockedFunction<typeof setCachedClassification>;
const generate = llmGenerate as jest.MockedFunction<typeof llmGenerate>;

beforeEach(() => jest.clearAllMocks());

it("reutiliza cache sem gastar provider", async () => {
  cached.mockResolvedValue({
    format: ["reel"], proposal: [], context: [], tone: [], references: [],
    contentIntent: [], narrativeForm: [], contentSignals: [], stance: [], proofStyle: [], commercialMode: [],
  });
  const result = await classifyContentWithAi("legenda");
  expect(result.provider).toBe("cache");
  expect(generate).not.toHaveBeenCalled();
});

it("pede JSON ao escopo CLASSIFICATION e normaliza a resposta Gemini", async () => {
  cached.mockResolvedValue(null);
  generate.mockResolvedValue({
    text: '```json\n{"contentIntent":["teach"],"narrativeForm":["tutorial"]}\n```',
    provider: "gemini",
    model: "gemini-2.5-flash-lite",
  });
  const result = await classifyContentWithAi("3 dicas para creators");
  expect(generate).toHaveBeenCalledWith(
    expect.objectContaining({ json: true, model: "gemini-2.5-flash-lite" }),
    { scope: "CLASSIFICATION" },
  );
  expect(result.classification.contentIntent).toEqual(["teach"]);
  expect(result.classification.narrativeForm).toEqual(["tutorial"]);
  expect(saveCache).toHaveBeenCalledTimes(1);
});
