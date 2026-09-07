/** @jest-environment node */
import { evidenceText, inferScriptGoal, metricPerformance, rankScriptEvidence, scoreScriptMetric } from "./scriptEvidenceSelection";

const now = new Date("2026-09-07T00:00:00Z");
const transcript = "Hoje eu vou explicar a minha rotina de trabalho com um exemplo real e simples.";
const metric = (id: string, interactions: number, watch = 10) => ({ _id: id, type: "REEL", postDate: "2026-09-01", stats: { reach: 1000, total_interactions: interactions, video_duration_seconds: 30, average_video_watch_time_seconds: watch } });
const evidence = (id: string, source = "gemini_video") => ({ metricId: id, transcript: { fullText: `${transcript} ${id}`, source }, completeness: { transcript: true }, narrative: { subjects: ["rotina"] } });

describe("seleção por evidência e resultado", () => {
  it.each([
    ["roteiro com o que mais engajou", "engagement"],
    ["com maior número de interações", "interactions"],
    ["vídeos mais compartilhados", "shares"], ["vídeos mais salvos", "saves"],
    ["abrir uma conversa", "conversation"], ["aumentar vendas", "conversion"],
  ])("interpreta %s como %s", (prompt, goal) => expect(inferScriptGoal(prompt)).toBe(goal));

  it("engajamento seleciona interações, mesmo quando a retenção diz o contrário", () => {
    const args = { metrics: [metric("a", 10, 28),metric("b", 100, 4)], evidence: [evidence("a"),evidence("b")], prompt: "rotina", now };
    expect(rankScriptEvidence({ ...args, goal: "engagement" }).selected[0]?.contentId).toBe("b");
    expect(rankScriptEvidence({ ...args, goal: "attention" }).selected[0]?.contentId).toBe("a");
  });
  it("preserva zero, não inventa taxa sem alcance e não conta interações duas vezes", () => {
    const performance = metricPerformance({ stats: { reach: 100, total_interactions: 0, comments: 50, shares: 20, saved: 10 } });
    expect(scoreScriptMetric(performance,"engagement").value).toBe(0);
    expect(scoreScriptMetric(metricPerformance({ stats: { total_interactions: 100 } }),"engagement").value).toBeNull();
    expect(scoreScriptMetric(performance,"conversation").value).toBe(0.5);
    expect(scoreScriptMetric(performance,"conversion").value).toBeNull();
  });
  it("roteiro planejado e legenda nunca contam como fala observada", () => {
    expect(evidenceText(evidence("a","stored_script"))).toMatchObject({ observed: "", planned: expect.any(String), source: "planned_script" });
    expect(evidenceText(evidence("a","caption_fallback"))).toMatchObject({ observed: "", fullText: "" });
  });
  it("texto legado sem verificação não é anunciado como integral", () => {
    expect(evidenceText(evidence("a")).quality).toMatchObject({ status: "unverified", completenessVerified: false });
    expect(evidenceText({ transcript: { source: "gemini_video", fullText: transcript.repeat(2500) } }).quality.truncated).toBe(true);
  });
  it("mede líderes sem transcrição e interseção real de texto com métricas", () => {
    const result = rankScriptEvidence({ metrics: [metric("a",100), metric("b",20), { _id:"c", stats:{} }], evidence:[evidence("b"),evidence("c")], prompt:"rotina", goal:"engagement", now });
    expect(result.coverage).toMatchObject({ published:3, metricsEligible:2, observedAvailable:2, observedAndMetrics:1, missingLeaderIds:["a"] });
  });
  it("atualização de métricas muda o ranking sem mudar nenhuma transcrição", () => {
    const corpus = [evidence("a"),evidence("b")];
    const result = rankScriptEvidence({ metrics:[metric("a",500),metric("b",100)], evidence:corpus, prompt:"rotina", goal:"engagement",now });
    expect(result.selected[0]?.contentId).toBe("a");
  });
  it("não usa contraste de assunto incompatível e mantém referências explícitas", () => {
    const result = rankScriptEvidence({ metrics:[metric("a",500),metric("b",100),metric("c",50),metric("d",1)], evidence:[... ["a","b","c"].map(id=>evidence(id)), { ...evidence("d"),narrative:{subjects:["automóveis"]} }], prompt:"rotina", goal:"engagement", now, requestedIds:["c"] });
    expect(result.selected[0]?.contentId).toBe("c");
    expect(result.contrast).toBeNull();
  });
});
