/** @jest-environment node */
import {
  MAX_INLINE_VIDEO_BYTES,
  SCENE_EVALUATION_VERSION,
  SCENE_MAX_OUTPUT_TOKENS,
  closeTruncatedObject,
  speechLooksHealthy,
  evaluateImagesAgainstMap,
  evaluateSceneAgainstMap,
  isRetryableGeminiSceneError,
  parseSceneEvaluation,
} from "./sceneEvaluation";
import type { MapProfile } from "./mapProfiles";

jest.mock("@/app/lib/llm/geminiUsageLog", () => ({ logGeminiUsage: jest.fn() }));

jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(),
  createUserContent: jest.fn((parts) => ({ role: "user", parts })),
  createPartFromBase64: jest.fn((data, mimeType) => ({ inlineData: { data, mimeType } })),
  createPartFromUri: jest.fn((uri, mimeType) => ({ fileData: { fileUri: uri, mimeType } })),
}));

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

  it("preserva transcrição integral, timeline e estrutura narrativa", () => {
    const result = parseSceneEvaluation(JSON.stringify({
      assets: [],
      tons: [],
      transcricao: "Primeira frase. Depois vem a entrega completa.",
      segmentos: [{ inicioMs: 0, fimMs: 2100, texto: "Primeira frase." }],
      cenas: [{
        inicioMs: 0,
        fimMs: 2100,
        papel: "gancho",
        descricao: "close no rosto",
        fala: "Primeira frase.",
        cenario: "escritório",
        objetos: ["microfone"],
        enquadramentos: ["close"],
      }],
      estrutura: ["gancho", "entrega"],
      promessa: "mostrar o processo",
      cta: "me conta o seu",
    }), profile)!;
    expect(result.transcript).toBe("Primeira frase. Depois vem a entrega completa.");
    expect(result.transcriptSegments).toEqual([{ startMs: 0, endMs: 2100, text: "Primeira frase." }]);
    expect(result.sceneTimeline[0]).toMatchObject({ role: "gancho", setting: "escritório", objects: ["microfone"] });
    expect(result.narrativeStructure).toEqual(["gancho", "entrega"]);
    expect(result.promise).toBe("mostrar o processo");
    expect(result.cta).toBe("me conta o seu");
  });
});

describe("evaluateImagesAgainstMap", () => {
  it("sem chave não baixa a foto nem faz chamada", async () => {
    const fetchImpl = jest.fn();
    const outcome = await evaluateImagesAgainstMap({
      mediaUrls: ["https://exemplo/foto.jpg"],
      profile,
      apiKey: "",
      fetchImpl: fetchImpl as unknown as typeof fetch,
    });
    expect(outcome).toMatchObject({ ok: false, retryable: false });
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("falha temporária em todos os slides pode ser reenfileirada", async () => {
    const outcome = await evaluateImagesAgainstMap({
      mediaUrls: ["https://exemplo/slide-1.jpg", "https://exemplo/slide-2.jpg"],
      profile,
      apiKey: "chave",
      fetchImpl: jest.fn().mockResolvedValue({ ok: false, status: 403 }) as unknown as typeof fetch,
    });
    expect(outcome).toMatchObject({ ok: false, retryable: true });
  });

  it("recusa post sem URL antes de chamar o provider", async () => {
    const outcome = await evaluateImagesAgainstMap({ mediaUrls: [], profile, apiKey: "chave" });
    expect(outcome).toMatchObject({ ok: false, retryable: false });
  });
});

describe("evaluateSceneAgainstMap", () => {
  it("sem chave não gasta chamada mesmo quando o criador ainda não tem mapa", async () => {
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

describe("classificação de falhas do Gemini", () => {
  it("não repete chamadas quando o crédito pré-pago acabou", () => {
    expect(isRetryableGeminiSceneError(
      '{"error":{"code":429,"message":"Your prepayment credits are depleted","status":"RESOURCE_EXHAUSTED"}}',
    )).toBe(false);
  });

  it("mantém rate limit e indisponibilidade temporária como retentáveis", () => {
    expect(isRetryableGeminiSceneError("429 rate limit exceeded")).toBe(true);
    expect(isRetryableGeminiSceneError("503 service unavailable")).toBe(true);
    expect(isRetryableGeminiSceneError("request timeout")).toBe(true);
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

describe('leitura completa por item', () => {
  const { GoogleGenAI } = jest.requireMock('@google/genai');
  const generateContent = jest.fn();
  const fetchImpl = jest.fn();
  beforeEach(() => {
    generateContent.mockReset(); fetchImpl.mockReset();
    GoogleGenAI.mockImplementation(() => ({ models: { generateContent } }));
    fetchImpl.mockResolvedValue({ ok: true, headers: { get: () => 'image/jpeg' }, arrayBuffer: async () => new Uint8Array([1]).buffer });
  });
  const response = (types: string[]) => JSON.stringify({ slides: types.map((tipo, i) => ({ posicao: i + 1, tipo, papel: 'entrega', descricao: `Item ${i+1}`, texto: 'Texto', transcricao: 'Fala' })) });
  it('lê mais de dez slides e não transforma texto de imagem em fala', async () => {
    generateContent.mockResolvedValue({ text: response(Array(12).fill('IMAGE')) });
    const result = await evaluateImagesAgainstMap({ mediaUrls: Array.from({length:12}, (_,i) => `foto${i}`), profile, apiKey: 'teste', fetchImpl });
    expect(fetchImpl).toHaveBeenCalledTimes(12);
    expect(result).toMatchObject({ ok: true, result: { version: 'cena_visual_v1', transcript: null, transcriptSegments: [], visualCoverage: { expected:12, analyzed:12, complete:true } } });
    if (result.ok) {
      expect(result.result.slides?.every(s => s.transcript === null)).toBe(true);
      expect(result.result.sceneTimeline.every(s => s.startMs === null && s.endMs === null)).toBe(true);
    }
  });
  it('envia vídeo interno com áudio e preserva sua transcrição no slide', async () => {
    fetchImpl.mockResolvedValueOnce({ ok:true, headers:{get:()=> 'video/mp4'}, arrayBuffer: async()=>new Uint8Array([1]).buffer });
    generateContent.mockResolvedValue({ text: response(['VIDEO', 'IMAGE']) });
    const result = await evaluateImagesAgainstMap({ mediaUrls: [], mediaItems:[{position:1,type:'VIDEO',url:'video'},{position:2,type:'IMAGE',url:'foto'}], profile, apiKey:'teste', fetchImpl });
    expect(result).toMatchObject({ ok:true, result: { slides:[{position:1,type:'VIDEO',transcript:'Fala'},{position:2,type:'IMAGE',transcript:null}] } });
    expect(generateContent.mock.calls[0][0].contents.parts).toContainEqual({ inlineData: { data:'AQ==', mimeType:'video/mp4' } });
  });
  it('não paga análise nem aprova o post se o segundo slide não baixar', async () => {
    fetchImpl.mockResolvedValueOnce({ok:true,headers:{get:()=> 'image/jpeg'},arrayBuffer:async()=>new Uint8Array([1]).buffer}).mockResolvedValueOnce({ok:false,status:403});
    expect(await evaluateImagesAgainstMap({mediaUrls:['a','b'],profile,apiKey:'teste',fetchImpl})).toMatchObject({ok:false,retryable:true,reason:expect.stringContaining('Item 2 de 2')});
    expect(generateContent).not.toHaveBeenCalled();
  });
  it('rejeita resposta que omite um item', async () => {
    generateContent.mockResolvedValue({text:response(['IMAGE'])});
    expect(await evaluateImagesAgainstMap({mediaUrls:['a','b'],profile,apiKey:'teste',fetchImpl})).toMatchObject({ok:false,retryable:false});
  });
});

describe("closeTruncatedObject", () => {
  it("fecha no último campo completo, ignorando vírgula dentro de texto e de lista", () => {
    expect(closeTruncatedObject('{"a":1,"b":"x, y","c":[1,2')).toBe('{"a":1,"b":"x, y"}');
  });
  it("respeita aspas escapadas", () => {
    const closed = closeTruncatedObject('{"a":"diz \\"oi\\", tchau","b":');
    expect(JSON.parse(closed!).a).toBe('diz "oi", tchau');
  });
  it("sem campo completo não inventa objeto", () => {
    expect(closeTruncatedObject('{"a":"abc')).toBeNull();
  });
});

describe("speechLooksHealthy", () => {
  it("reprova fala repetida em loop", () => {
    expect(speechLooksHealthy(Array(40).fill("e aí gente tudo bem com vocês hoje").join(" "), 120)).toBe(false);
  });
  it("aprova fala normal", () => {
    expect(speechLooksHealthy("bom dia gente hoje vou mostrar a rotina", 5)).toBe(true);
  });
  it("reprova texto denso demais para a duração do vídeo", () => {
    expect(speechLooksHealthy("palavra ".repeat(60), 5)).toBe(false);
  });
});

describe("leitura cortada no teto", () => {
  const { GoogleGenAI } = jest.requireMock("@google/genai");
  const generateContent = jest.fn();
  const video = (async () => ({
    ok: true,
    headers: { get: () => "video/mp4" },
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  })) as unknown as typeof fetch;
  const mapa = '"assets":["A1"],"tons":["T1"],"assuntos":[],"local":"L1","enquadramento":[],"estetica":[],"temas":["rotina da manhã"],"objetos":[],"falas":[],"titulo":"","fala":"bom dia"';
  const loop = Array(40).fill("e aí gente tudo bem com vocês hoje").join(" ");
  const cut = (text: string) => ({ text, candidates: [{ finishReason: "MAX_TOKENS" }] });
  const read = () => evaluateSceneAgainstMap({ mediaUrl: "https://exemplo/v.mp4", durationSeconds: 30, profile, apiKey: "teste", fetchImpl: video });

  beforeEach(() => {
    generateContent.mockReset();
    GoogleGenAI.mockImplementation(() => ({ models: { generateContent } }));
  });

  it("aproveita o mapa cortado com uma única chamada e sinaliza leitura parcial", async () => {
    generateContent.mockResolvedValueOnce(cut(`{${mapa},"transcricao":"${loop}`));
    const outcome = await read();
    expect(outcome).toMatchObject({ ok: true, result: { readingCompleteness: "partial", transcript: null, assetRoleIds: ["parceiro_em_cena"] } });
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(generateContent.mock.calls[0][0].config).toMatchObject({ temperature: 0, maxOutputTokens: SCENE_MAX_OUTPUT_TOKENS });  });

  it("cortada: aproveita o mapa e descarta a fala em loop", async () => {
    generateContent.mockResolvedValue(cut(`{${mapa},"transcricao":"${loop}","segmentos":[{"inicioMs":0,"fimMs":10,"texto":"e aí`));
    const outcome = await read();
    expect(generateContent).toHaveBeenCalledTimes(1);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.result).toMatchObject({ assetRoleIds: ["parceiro_em_cena"], toneIds: ["humor"], transcript: null, transcriptSegments: [] });
      expect(outcome.result.subjects).toEqual(["rotina da manhã"]);
    }
  });

  it("mantém a fala sã quando o corte veio depois dela", async () => {
    generateContent.mockResolvedValue(cut(`{${mapa},"transcricao":"bom dia gente hoje vou mostrar a rotina","segmentos":[],"cenas":[{"descricao":"cozinha`));
    const outcome = await read();
    expect(outcome).toMatchObject({ ok: true, result: { transcript: "bom dia gente hoje vou mostrar a rotina", sceneTimeline: [] } });
  });

  it("ilegível na primeira tentativa não grava nada", async () => {
    generateContent.mockResolvedValue({ text: "não sei", candidates: [{ finishReason: "STOP" }] });
    expect(await read()).toEqual({ ok: false, reason: "Resposta ilegível.", retryable: false });
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});

describe("contrato compacto de vídeo", () => {
  const { GoogleGenAI } = jest.requireMock("@google/genai");
  const generateContent = jest.fn();
  const video = (async () => new Response(new Uint8Array([1]), { headers: { "content-type": "video/mp4" } })) as typeof fetch;
  beforeEach(() => { generateContent.mockReset(); GoogleGenAI.mockImplementation(() => ({ models: { generateContent } })); });
  it("monta a transcrição e a fala da cena sem pedir cópias ao modelo", async () => {
    generateContent.mockResolvedValue({ text: JSON.stringify({ formato: "scene_segments_v1", segmentos: [{ id: "s1", inicioMs: 0, fimMs: 2000, texto: "Hoje vou mostrar minha cozinha." }], cenas: [{ inicioMs: 0, fimMs: 3000, descricao: "Pessoa na cozinha", segmentos: ["s1"] }] }), candidates: [{ finishReason: "STOP" }] });
    const result = await evaluateSceneAgainstMap({ mediaUrl: "video", durationSeconds: 3, profile, apiKey: "teste", fetchImpl: video, responseFormat: "scene_segments_v1" });
    expect(result).toMatchObject({ ok: true, result: { responseFormat: "scene_segments_v1", transcript: "Hoje vou mostrar minha cozinha.", sceneTimeline: [{ spokenText: "Hoje vou mostrar minha cozinha." }] } });
    const format = generateContent.mock.calls[0][0].contents.parts[1];
    const example = JSON.parse(format.split("\n")[1]);
    expect(example).not.toHaveProperty("transcricao");
    expect(example.cenas[0]).not.toHaveProperty("fala");
    expect(example.segmentos[0]).toHaveProperty("texto");
    expect(generateContent).toHaveBeenCalledTimes(1);
  });
});
