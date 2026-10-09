/** @jest-environment node */
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

const graphApiRequest = jest.fn();
const graphApiNodeRequest = jest.fn();
jest.mock("./client", () => ({
  graphApiRequest: (...args: unknown[]) => graphApiRequest(...args),
  graphApiNodeRequest: (...args: unknown[]) => graphApiNodeRequest(...args),
}));

import { fetchInstagramMedia, fetchSingleInstagramMedia } from "./fetchers";

const childFields = (url: string) => /children\{([^}]*)\}/.exec(decodeURIComponent(url))?.[1] ?? "";

describe("listagem de mídias não some com carrossel", () => {
  beforeEach(() => {
    graphApiRequest.mockReset().mockResolvedValue({ data: [] });
    graphApiNodeRequest.mockReset().mockResolvedValue({ id: "m1" });
  });

  it("não pede media_product_type nos itens do carrossel (a API omite o carrossel inteiro)", async () => {
    await fetchInstagramMedia("conta", "token");
    const fields = childFields(String(graphApiRequest.mock.calls[0][0]));
    expect(fields).toContain("media_type");
    expect(fields).not.toContain("media_product_type");
  });

  it("retoma a paginação pelo cursor sem guardar a URL com o token", async () => {
    await fetchInstagramMedia("conta", "token", undefined, { after: "QVFI" });
    expect(String(graphApiRequest.mock.calls[0][0])).toContain("&after=QVFI");
  });

  it("a mídia individual também não pede media_product_type nos itens", async () => {
    await fetchSingleInstagramMedia("m1", "token");
    const url = String((graphApiNodeRequest.mock.calls[0] ?? graphApiRequest.mock.calls[0])?.[0] ?? "");
    expect(childFields(url)).not.toContain("media_product_type");
  });
});
