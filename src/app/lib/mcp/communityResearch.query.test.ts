/** @jest-environment node */

import { Types } from "mongoose";
import MetricModel from "@/app/models/Metric";
import UserModel from "@/app/models/User";
import { buildInspirationTopicMatch, researchMcpInspirationContent } from "./communityResearch";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => undefined) }));
jest.mock("@/app/models/Metric", () => ({
  __esModule: true,
  default: { aggregate: jest.fn(), find: jest.fn() },
}));
jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { find: jest.fn() },
}));

const aggregate = jest.mocked(MetricModel.aggregate);
const optedIn = [{ _id: new Types.ObjectId("507f1f77bcf86cd799439022"), name: "Creator", username: "creator" }];

function mockOptedInCreators() {
  jest.mocked(UserModel.find).mockReturnValue({
    select: () => ({ lean: async () => optedIn }),
  } as never);
}

it("filtra o assunto antes de cortar os candidatos recentes", async () => {
  mockOptedInCreators();
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

it("não faz $lookup de usuário por post e só busca quem autorizou", async () => {
  mockOptedInCreators();
  aggregate.mockReturnValue({ exec: jest.fn(async () => []) } as never);

  await researchMcpInspirationContent({
    userId: "507f1f77bcf86cd799439011",
    mode: "winning_patterns",
    query: "maternidade",
    topicPrefilter: "maternidade",
    filters: {
      formats: [], tones: [], hookPatterns: [], sceneKeywords: [],
      objects: [], framing: [], aesthetics: [],
    },
    periodDays: 180,
    limit: 5,
  });

  const pipeline = aggregate.mock.calls.at(-1)?.[0] as Array<Record<string, any>>;
  expect(pipeline.some((stage) => "$lookup" in stage)).toBe(false);
  expect(pipeline[0]!.$match.user.$in).toEqual(optedIn.map((creator) => creator._id));
  // O radar pede pré-seleção por assunto mesmo fora do modo by_topic.
  const hasTopic = pipeline.some((stage) => Array.isArray(stage.$match?.$or) && stage.$match.$or.some((rule: any) => rule.description));
  expect(hasTopic).toBe(true);
});
