/** @jest-environment node */
import { fetchPublicText, robotsAllows, withCollectionBudget } from "./guardedHttp";
import { collectionBlockReason, collectionPolicy } from "./collectionPolicy";
import { collectCampaignRadar } from "./collect";

const allowed = "https://www.tijucageekfestival.com.br/";
describe("coleta sem API paga", () => {
  const originalFetch = global.fetch;
  beforeEach(() => { jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate"] }); jest.setSystemTime(new Date("2026-09-07T12:00:00Z")); global.fetch = jest.fn(); });
  afterEach(() => { global.fetch = originalFetch; jest.useRealTimers(); });

  it.each(["https://linktr.ee/creatorads.br", "https://api.x.com/2/tweets/search/recent", "https://graph.threads.net/keyword_search", "https://127.0.0.1/", "https://example.com/", `${allowed}?token=abc`])("não faz requisição para %s", async (url) => {
    await expect(fetchPublicText(url)).rejects.toThrow(); expect(fetch).not.toHaveBeenCalled();
  });
  it("recusa custo pago, desconhecido ou revisão vencida", () => {
    expect(collectionBlockReason(collectionPolicy("x-search"))).not.toBeNull();
    expect(collectionBlockReason(collectionPolicy("threads-search"))).not.toBeNull();
    expect(collectionBlockReason(collectionPolicy("tijuca-geek-public-coverage"), new Date("2026-11-01"))).not.toBeNull();
  });
  it("não consulta conteúdo proibido pelo robots", async () => {
    (fetch as jest.Mock).mockResolvedValue(new Response("User-agent: *\nDisallow: /"));
    await expect(fetchPublicText(allowed)).rejects.toThrow("radar_robots_blocked");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("redirecionamento nunca alcança um segundo host", async () => {
    (fetch as jest.Mock).mockResolvedValueOnce(new Response("", { status: 404 })).mockResolvedValueOnce(new Response(null, { status: 302, headers: { location: "https://api.x.com/" } }));
    await expect(fetchPublicText(allowed)).rejects.toThrow("radar_http_302");
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(fetch).toHaveBeenLastCalledWith(allowed, expect.objectContaining({ redirect: "manual" }));
  });
  it("interrompe o volume antes de exceder 12 requisições", async () => {
    (fetch as jest.Mock).mockImplementation(async () => new Response(""));
    await expect(withCollectionBudget(async () => { for (let i = 0; i < 12; i++) await fetchPublicText(allowed); })).rejects.toThrow("radar_request_budget_exhausted");
    expect(fetch).toHaveBeenCalledTimes(12);
  });
  it("um lote tolera fontes bloqueadas sem consultá-las", async () => {
    (fetch as jest.Mock).mockImplementation(async () => new Response(""));
    const result = await collectCampaignRadar();
    expect(result.sources).toHaveLength(8);
    for (const [url] of (fetch as jest.Mock).mock.calls) expect(new URL(url).hostname).toMatch(/^(www\.tijucageekfestival\.com\.br|ajuda\.upabc\.com\.br)$/);
    expect(result.sources.find((source) => source.sourceId === "creator-ads-public-calls")?.discoveredDocuments).toBe(0);
  });
  it("aplica regras específicas, curingas e desempate de Allow", () => {
    expect(robotsAllows("User-agent: *\nDisallow: /\nAllow: /public", "/public/item")).toBe(true);
    expect(robotsAllows("User-agent: *\nDisallow: /*?secret=", "/?secret=1")).toBe(false);
    expect(robotsAllows("User-agent: *\nDisallow: /\nUser-agent: Data2Content\nAllow: /", "/")).toBe(true);
  });
});
