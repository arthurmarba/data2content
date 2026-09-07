/** @jest-environment node */
import { REEL_INSIGHTS_METRICS } from "../config/instagramApiConfig";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const graphApiRequest = jest.fn();
jest.mock("./client", () => ({
  graphApiRequest: (...args: unknown[]) => graphApiRequest(...args),
  graphApiNodeRequest: jest.fn(),
}));

import { fetchMediaInsights, resetMediaInsightMetricRejectionsForTests } from "./fetchers";

const invalidMetric = {
  error: { code: 100, message: "(#100) metric[4] must be one of the following values: reach, views", type: "OAuthException" },
};
const ok = { data: [{ name: "reach", values: [{ value: 500 }] }] };

const requestedMetrics = () => String(graphApiRequest.mock.calls.at(-1)?.[0] ?? "");

describe("métrica opcional recusada não derruba a leitura do post", () => {
  beforeEach(() => {
    graphApiRequest.mockReset();
    resetMediaInsightMetricRejectionsForTests();
  });

  it("pede follows para reels", () => {
    expect(REEL_INSIGHTS_METRICS.split(",")).toContain("follows");
  });

  it("repete sem a métrica opcional em vez de perder alcance e interações", async () => {
    graphApiRequest.mockResolvedValueOnce(invalidMetric).mockResolvedValueOnce(ok);

    const result = await fetchMediaInsights("media-1", "token", REEL_INSIGHTS_METRICS);

    expect(graphApiRequest).toHaveBeenCalledTimes(2);
    expect(requestedMetrics()).not.toContain("follows");
    expect(requestedMetrics()).toContain("reach");
    expect(result).toMatchObject({ success: true, data: { reach: 500 } });
  });

  it("não repete a pergunta recusada nos próximos posts da mesma execução", async () => {
    graphApiRequest.mockResolvedValueOnce(invalidMetric).mockResolvedValue(ok);
    await fetchMediaInsights("media-1", "token", REEL_INSIGHTS_METRICS);
    graphApiRequest.mockClear();

    await fetchMediaInsights("media-2", "token", REEL_INSIGHTS_METRICS);

    expect(graphApiRequest).toHaveBeenCalledTimes(1);
    expect(requestedMetrics()).not.toContain("follows");
  });

  it("mantém a métrica quando a API aceita", async () => {
    graphApiRequest.mockResolvedValue({ data: [{ name: "follows", values: [{ value: 12 }] }] });

    const result = await fetchMediaInsights("media-1", "token", REEL_INSIGHTS_METRICS);

    expect(graphApiRequest).toHaveBeenCalledTimes(1);
    expect(requestedMetrics()).toContain("follows");
    expect(result.data).toMatchObject({ follows: 12 });
  });

  it("não entra em laço quando o erro persiste sem métrica opcional", async () => {
    graphApiRequest.mockResolvedValue(invalidMetric);

    const result = await fetchMediaInsights("media-1", "token", REEL_INSIGHTS_METRICS);

    expect(graphApiRequest).toHaveBeenCalledTimes(2);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/Métrica inválida/);
  });

  it("não mexe em listas que não pedem métrica opcional", async () => {
    graphApiRequest.mockResolvedValue(invalidMetric);

    const result = await fetchMediaInsights("media-1", "token", "reach,views");

    expect(graphApiRequest).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });
});
