import { computePerPautaCacheKey } from "./perPautaCollabCache";
import type { PautaForMatch } from "./perPautaCollabMatchingService";

const p = (id: string, territory: string, title?: string): PautaForMatch => ({ id, territory, title });

describe("computePerPautaCacheKey", () => {
  it("é estável pro mesmo input", () => {
    const a = computePerPautaCacheKey([p("1", "Paternidade"), p("2", "Rotina")], "minha narrativa");
    const b = computePerPautaCacheKey([p("1", "Paternidade"), p("2", "Rotina")], "minha narrativa");
    expect(a).toBe(b);
  });

  it("independe da ORDEM das pautas", () => {
    const a = computePerPautaCacheKey([p("1", "Paternidade"), p("2", "Rotina")], "narrativa");
    const b = computePerPautaCacheKey([p("2", "Rotina"), p("1", "Paternidade")], "narrativa");
    expect(a).toBe(b);
  });

  it("independe de caixa/espaço no território e na narrativa", () => {
    const a = computePerPautaCacheKey([p("1", "Paternidade")], "Minha Narrativa");
    const b = computePerPautaCacheKey([p("1", "  paternidade ")], "  minha narrativa  ");
    expect(a).toBe(b);
  });

  it("muda quando entra/sai uma pauta (invalida o cache)", () => {
    const a = computePerPautaCacheKey([p("1", "Paternidade")], "narrativa");
    const b = computePerPautaCacheKey([p("1", "Paternidade"), p("2", "Rotina")], "narrativa");
    expect(a).not.toBe(b);
  });

  it("muda quando o território de uma pauta muda", () => {
    const a = computePerPautaCacheKey([p("1", "Paternidade")], "narrativa");
    const b = computePerPautaCacheKey([p("1", "Trabalho")], "narrativa");
    expect(a).not.toBe(b);
  });

  it("muda quando o título de uma pauta muda", () => {
    const a = computePerPautaCacheKey([p("1", "Paternidade", "Título A")], "narrativa");
    const b = computePerPautaCacheKey([p("1", "Paternidade", "Título B")], "narrativa");
    expect(a).not.toBe(b);
  });

  it("muda quando a narrativa muda", () => {
    const a = computePerPautaCacheKey([p("1", "Paternidade")], "narrativa A");
    const b = computePerPautaCacheKey([p("1", "Paternidade")], "narrativa B");
    expect(a).not.toBe(b);
  });
});
