/** @jest-environment node */

import MetricModel from "@/app/models/Metric";
import { buildInspirationTopicMatch, researchMcpInspirationContent } from "./communityResearch";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => undefined) }));
jest.mock("@/app/models/Metric", () => ({
  __esModule: true,
  default: { aggregate: jest.fn() },
}));

const aggregate = jest.mocked(MetricModel.aggregate);

it("filtra o assunto antes de cortar os candidatos recentes", async () => {
  aggregate.mockReturnValue({ exec: jest.fn(async () => []) } as never);

  await researchMcpInspirationContent({
    userId: "507f1f77bcf86cd799439011",
    mode: "by_topic",
    query: "marketing",
    filters: {
      formats: [], tones: [], hookPatterns: [], sceneKeywords: [],
      objects: [], framing: [], aesthetics: [],
    },
    periodDays: 180,
    limit: 5,
  });

  const pipeline = aggregate.mock.calls[0]?.[0] as Array<Record<string, unknown>>;
  const topicIndex = pipeline.findIndex((stage) => {
    const match = stage.$match as { $or?: Array<Record<string, { $regex: string; $options: string }>> } | undefined;
    const rule = match?.$or?.find((item) => item.description)?.description;
    return rule ? new RegExp(rule.$regex, rule.$options).test("marketing") : false;
  });
  const limitIndex = pipeline.findIndex((stage) => "$limit" in stage);
  expect(topicIndex).toBeGreaterThan(0);
  expect(topicIndex).toBeLessThan(limitIndex);
});

it("encontra palavras com e sem acento na pré-seleção", () => {
  const match = buildInspirationTopicMatch("inteligencia artificial") as {
    $or: Array<Record<string, { $regex: string; $options: string }>>;
  };
  const descriptionRule = match.$or.find((rule) => rule.description)?.description;
  expect(descriptionRule).toBeDefined();
  const regex = new RegExp(descriptionRule!.$regex, descriptionRule!.$options);
  expect(regex.test("Inteligência artificial no trabalho")).toBe(true);
  expect(regex.test("Inteligencia artificial no trabalho")).toBe(true);
});
