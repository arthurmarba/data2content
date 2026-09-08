/** @jest-environment node */
import { candidateKeys, manualOpportunity } from "./intake";

const input = { title: "Campanha de teste", text: "Reels de viagem para uma marca.", sourceUrl: "https://example.com/post", applicationUrl: "https://example.com/apply?id=1" };
describe("entrada manual", () => {
  it("não inventa remuneração, prazo nem aprovação", () => {
    expect(manualOpportunity(input)).toMatchObject({ applicationDeadline: null, status: "uncertain", compensation: { confirmed: false, minimum: null }, review: { status: "pending" } });
  });
  it("remove rastreamento da deduplicação e preserva o identificador da chamada", () => {
    const a = candidateKeys(manualOpportunity(input));
    const b = candidateKeys(manualOpportunity({ ...input, applicationUrl: `${input.applicationUrl}&utm_source=email#top` }));
    const c = candidateKeys(manualOpportunity({ ...input, applicationUrl: "https://example.com/apply?id=2" }));
    expect(a).toEqual(b); expect(a.key).not.toBe(c.key);
  });
  it.each([{ sourceUrl: "javascript:alert(1)" }, { applicationDeadline: "2026-02-31" }, { compensationMinimum: 500, compensationMaximum: 100 }, { sourceId: "inventada" }, { review: { status: "approved" } }])("recusa entrada inválida %j", (override) => {
    expect(() => manualOpportunity({ ...input, ...override })).toThrow();
  });
});
