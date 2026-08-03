import {
  MAX_INLINE_VIDEO_BYTES,
  SCENE_EVALUATION_VERSION,
  evaluateSceneAgainstMap,
  parseSceneEvaluation,
} from "./sceneEvaluation";
import type { MapProfile } from "./mapProfiles";

/** Mapa real de um criador de Maternidade, do jeito que o card guarda. */
const profile: MapProfile = {
  creatorId: "c1",
  territoryIds: ["maternidade"],
  primaryTerritoryId: "maternidade",
  narrative: "Uma mãe real que encontra beleza e humor na rotina",
  narrativeConfirmed: true,
  assets: [
    { ownLabel: "a esposa (Lívia)", roleId: "parceiro_em_cena", roleLabel: "Parceiro em cena", group: "vida", confirmed: true },
    { ownLabel: "meus filhos", roleId: "filho_em_cena", roleLabel: "Filho em cena", group: "vida", confirmed: true },
    { ownLabel: "a cozinha bagunçada", roleId: "cozinha", roleLabel: "Cozinha", group: "cenario", confirmed: false },
  ],
  toneIds: ["humor", "acolhedor"],
  subjects: [
    { ownLabel: "Sair do trabalho a tempo de viver a vida familiar", subjectId: "vida_em_familia", label: "Vida em família" },
  ],
  misplacedTerritoryLabels: [],
  maturity: "instagram_enriched",
};

describe("parseSceneEvaluation — códigos do mapa viram PAPÉIS", () => {
  it("traduz A1/A2 para o papel canônico, nunca o rótulo do criador", () => {
    const result = parseSceneEvaluation('{"assets":["A1","A2"],"tons":["T1"]}', profile)!;
    expect(result.assetRoleIds).toEqual(["parceiro_em_cena", "filho_em_cena"]);
    expect(result.toneIds).toEqual(["humor"]);
    // Regra 3: o nome próprio do mapa não escapa.
    expect(JSON.stringify(result)).not.toContain("Lívia");
  });

  it("aceita listas vazias — vídeo fora do mapa é resposta válida", () => {
    const result = parseSceneEvaluation('{"assets":[],"tons":[]}', profile)!;
    expect(result.assetRoleIds).toEqual([]);
    expect(result.offMap).toBe(true);
  });

  it("offMap é false quando qualquer coisa do mapa apareceu", () => {
    expect(parseSceneEvaluation('{"assets":["A3"],"tons":[]}', profile)!.offMap).toBe(false);
    expect(parseSceneEvaluation('{"assets":[],"tons":["T2"]}', profile)!.offMap).toBe(false);
  });

  it("descarta código fora da lista do criador — o modelo não inventa item", () => {
    const result = parseSceneEvaluation('{"assets":["A1","A9","X1"],"tons":["T7"]}', profile)!;
    expect(result.assetRoleIds).toEqual(["parceiro_em_cena"]);
    expect(result.toneIds).toEqual([]);
  });

  it("deduplica quando dois códigos apontam para o mesmo papel", () => {
    const doisFilhos: MapProfile = {
      ...profile,
      assets: [
        { ownLabel: "a filha", roleId: "filho_em_cena", roleLabel: "Filho em cena", group: "vida", confirmed: false },
        { ownLabel: "o filho", roleId: "filho_em_cena", roleLabel: "Filho em cena", group: "vida", confirmed: false },
      ],
    };
    const result = parseSceneEvaluation('{"assets":["A1","A2"],"tons":[]}', doisFilhos)!;
    expect(result.assetRoleIds).toEqual(["filho_em_cena"]);
  });

  it("tolera cerca de código e texto em volta", () => {
    const messy = 'Claro!\n```json\n{"assets":["A2"],"tons":[]}\n```\n';
    expect(parseSceneEvaluation(messy, profile)!.assetRoleIds).toEqual(["filho_em_cena"]);
  });

  it("devolve null para resposta ilegível", () => {
    expect(parseSceneEvaluation(null, profile)).toBeNull();
    expect(parseSceneEvaluation("não consegui", profile)).toBeNull();
    expect(parseSceneEvaluation("{quebrado", profile)).toBeNull();
  });

  it("carrega a versão CORRENTE — reprocesso é explícito", () => {
    // Compara com a constante, não com um literal: a versão sobe quando o prompt muda,
    // e um literal aqui quebraria o teste em vez de proteger o comportamento.
    expect(parseSceneEvaluation('{"assets":["A1"]}', profile)!.version).toBe(
      SCENE_EVALUATION_VERSION,
    );
  });
});

describe("evaluateSceneAgainstMap", () => {
  it("não gasta chamada quando o criador não tem asset nem tom no mapa", async () => {
    const fetchImpl = jest.fn();
    const outcome = await evaluateSceneAgainstMap({
      mediaUrl: "https://exemplo/v.mp4",
      durationSeconds: 30,
      profile: { ...profile, assets: [], toneIds: [] },
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toMatchObject({ ok: false, retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("recusa vídeo acima do teto de duração antes de baixar", async () => {
    const fetchImpl = jest.fn();
    const outcome = await evaluateSceneAgainstMap({
      mediaUrl: "https://exemplo/v.mp4",
      durationSeconds: 400,
      profile,
      apiKey: "chave",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toMatchObject({ ok: false, retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("403 no download é retentável — a media_url do Instagram expira", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 403 });
    const outcome = await evaluateSceneAgainstMap({
      mediaUrl: "https://exemplo/v.mp4",
      durationSeconds: 30,
      profile,
      apiKey: "chave",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toMatchObject({ ok: false, retryable: true });
  });

  it("404 no download não é retentável", async () => {
    const fetchImpl = jest.fn().mockResolvedValue({ ok: false, status: 404 });
    const outcome = await evaluateSceneAgainstMap({
      mediaUrl: "https://exemplo/v.mp4",
      durationSeconds: 30,
      profile,
      apiKey: "chave",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toMatchObject({ ok: false, retryable: false });
  });

  it("sem chave não tenta nada", async () => {
    const outcome = await evaluateSceneAgainstMap({
      mediaUrl: "https://exemplo/v.mp4",
      durationSeconds: 30,
      profile,
      apiKey: "",
    });
    expect(outcome).toMatchObject({ ok: false, retryable: false });
  });
});

describe("teto de tamanho — inline vs Files API", () => {
  const bigResponse = (mb: number) => ({
    ok: true,
    status: 200,
    headers: { get: () => "video/mp4" },
    arrayBuffer: async () => new ArrayBuffer(mb * 1024 * 1024),
  });

  it("o teto inline é 14MB, não 18 — base64 infla 33% e o request para em 20MB", () => {
    expect(MAX_INLINE_VIDEO_BYTES).toBe(14 * 1024 * 1024);
    // Um vídeo de 18MB viraria ~24MB de payload: acima do limite do request.
    expect((18 * 1024 * 1024 * 4) / 3).toBeGreaterThan(20 * 1024 * 1024);
    // No teto, o payload ainda cabe com folga para o prompt.
    expect((MAX_INLINE_VIDEO_BYTES * 4) / 3).toBeLessThan(20 * 1024 * 1024);
  });

  it("vídeo acima do teto absoluto é recusado — não é reel", async () => {
    const outcome = await evaluateSceneAgainstMap({
      mediaUrl: "https://exemplo/v.mp4",
      durationSeconds: 60,
      profile,
      apiKey: "chave",
      fetchImpl: (async () => bigResponse(250)) as unknown as typeof fetch,
    });
    expect(outcome).toMatchObject({ ok: false, retryable: false });
    if (!outcome.ok) expect(outcome.reason).toContain("grande demais");
  });

  it("vídeo entre 14MB e o teto absoluto NÃO é recusado por tamanho", async () => {
    // Antes ele falhava com "acima do teto inline" e o relatório perdia ~20% dos
    // vídeos. Agora segue para a Files API — aqui a chamada falha por falta de rede,
    // que é outro erro, e é justamente o ponto: não é mais rejeitado por tamanho.
    const outcome = await evaluateSceneAgainstMap({
      mediaUrl: "https://exemplo/v.mp4",
      durationSeconds: 60,
      profile,
      apiKey: "chave-invalida",
      fetchImpl: (async () => bigResponse(20)) as unknown as typeof fetch,
    });
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.reason).not.toContain("teto inline");
      expect(outcome.reason).not.toContain("grande demais");
    }
  });
});
