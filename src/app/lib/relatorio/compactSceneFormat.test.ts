/** @jest-environment node */
import { expandCompactScene, COMPACT_SCENE_FORMAT } from "./compactSceneFormat";
import { chooseSceneFormat } from "./sceneReadingRollout";
import { assessTranscriptQuality } from "../scripts/transcriptQuality";
const sample = () => ({ formato: COMPACT_SCENE_FORMAT,
  segmentos: [{ id: "s1", inicioMs: 1000, fimMs: 3000, texto: "Não paguei 30 reais." }, { id: "s2", inicioMs: 5000, fimMs: 7000, texto: "Paguei 13, Ana." }],
  cenas: [{ inicioMs: 0, fimMs: 2000, descricao: "cozinha", segmentos: ["s1"] }, { inicioMs: 2000, fimMs: 8000, descricao: "mesa", segmentos: ["s1", "s2"] }],
});
it("preserva negação, números, nomes e frase atravessando corte sem duplicar a transcrição", () => {
  const result = expandCompactScene(sample(), 8)!;
  expect(result.transcricao).toBe("Não paguei 30 reais. Paguei 13, Ana.");
  expect((result.cenas as any[]).map(s => s.fala)).toEqual(["Não paguei 30 reais.", "Não paguei 30 reais. Paguei 13, Ana."]);
});
it("tolera os deslizes medidos no experimento sem inventar fala", () => {
  const data: any = sample();
  data.cenas[0].segmentos = ["s9", "s1", "s1"]; // inexistente e duplicada
  data.cenas[1].segmentos = ["s2", "s1"]; // fora de ordem
  data.cenas.push({ inicioMs: 7000, fimMs: 25400, descricao: "final" }); // sem lista e além do fim
  data.segmentos[1].fimMs = 9500; // além do fim
  const result: any = expandCompactScene(data, 8)!;
  expect(result.cenas.map((s: any) => s.fala)).toEqual(["Não paguei 30 reais.", "Não paguei 30 reais. Paguei 13, Ana.", ""]);
  expect(result.cenas[2].fimMs).toBe(8000);
  expect(result.segmentos[1].fimMs).toBe(8000);
});
it("tempo inválido vira nulo e id repetido não é referenciável, mas o texto fica", () => {
  const data: any = sample();
  data.segmentos[0].fimMs = -1;
  data.segmentos[1].id = "s1";
  const result: any = expandCompactScene(data, 8)!;
  expect(result.transcricao).toBe("Não paguei 30 reais. Paguei 13, Ana.");
  expect(result.segmentos[0].fimMs).toBeNull();
  expect(result.cenas[1].fala).toBe("Não paguei 30 reais.");
});
it("resposta completa sem as listas continua recusada", () => {
  expect(expandCompactScene({ formato: COMPACT_SCENE_FORMAT, cenas: [] }, 8)).toBeNull();
  expect(expandCompactScene({ formato: "outro", segmentos: [], cenas: [] }, 8)).toBeNull();
});
it("silêncio não gera palavras nem fala inventada", () => {
  expect(expandCompactScene({ formato: COMPACT_SCENE_FORMAT, segmentos: [], cenas: [{ inicioMs: 0, fimMs: 8000, descricao: "paisagem", segmentos: [] }] }, 8)).toMatchObject({ transcricao: "", cenas: [{ fala: "" }] });
});
it("resposta cortada pode conservar dados visuais sem fabricar uma transcrição", () => {
  expect(expandCompactScene({ formato: COMPACT_SCENE_FORMAT, temas: ["rotina"] }, 8, true)).toMatchObject({ transcricao: "", segmentos: [], cenas: [], temas: ["rotina"] });
  expect(expandCompactScene({ formato: COMPACT_SCENE_FORMAT, temas: ["rotina"] }, 8)).toBeNull();
});
it("corte na fala conserva as cenas, que vêm antes no pedido", () => {
  const { segmentos, ...cut } = sample();
  expect(expandCompactScene(cut, 8, true)).toMatchObject({ transcricao: "", segmentos: [], cenas: [{ descricao: "cozinha", fala: "" }, { descricao: "mesa", fala: "" }] });
});
it("segmentos seguem o mesmo critério de cobertura do formato antigo, sem prometer fidelidade ao áudio", () => {
  const text = "Hoje vou contar o que aconteceu na minha casa.";
  expect(assessTranscriptQuality(text, [{ startMs: 0, endMs: 10000, text }], 10, false, "segments")).toMatchObject({ status: "complete", structuralConsistent: true, audioFidelityVerified: false, assemblySource: "segments" });
  expect(assessTranscriptQuality(text, [{ startMs: 1000, endMs: 2000, text }], 10, false, "segments")).toMatchObject({ status: "unverified", structuralConsistent: true });
  expect(assessTranscriptQuality(text, [{ startMs: 0, endMs: 10000, text }], 10, true, "segments").status).toBe("partial");
});
it("seleção estável respeita desligamento e percentuais suportados", () => {
  expect(chooseSceneFormat("post", 0)).toBe("scene_legacy_v1");
  expect(chooseSceneFormat("post", 100)).toBe(COMPACT_SCENE_FORMAT);
  expect(chooseSceneFormat("post", 999)).toBe("scene_legacy_v1");
  expect(chooseSceneFormat("post", 10)).toBe(chooseSceneFormat("post", 10));
});
