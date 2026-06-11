// src/app/lib/mapaSeed/analyzeInstagramPosts.test.ts

import {
  preparePostSummaries,
  selectVisualPosts,
  analyzeInstagramPosts,
  type InstagramPostSummary,
} from "./analyzeInstagramPosts";
import type { InstagramMedia } from "@/app/lib/instagram/types";

jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));

// Evita carregar o ESM de @google/genai no Jest. O caminho Gemini é pulado em
// teste (NODE_ENV=test), então o mock só precisa existir.
jest.mock("@google/genai", () => ({
  GoogleGenAI: jest.fn(),
  createUserContent: jest.fn((parts) => ({ role: "user", parts })),
  createPartFromBase64: jest.fn((data, mimeType) => ({ inlineData: { data, mimeType } })),
}));

// claudeService já tem stub interno para NODE_ENV=test (retorna "{}").

function makeSummary(over: Partial<InstagramPostSummary>): InstagramPostSummary {
  return {
    id: "x",
    tipo: "Foto",
    legenda: "",
    hashtags: [],
    data: "",
    imageUrl: "http://img/x.jpg",
    ...over,
  };
}

describe("preparePostSummaries", () => {
  it("resolve imageUrl por tipo de mídia", () => {
    const posts: InstagramMedia[] = [
      { id: "foto", media_type: "IMAGE", media_url: "http://img/foto.jpg" },
      { id: "video", media_type: "VIDEO", media_url: "http://img/v.mp4", thumbnail_url: "http://img/v.jpg" },
      {
        id: "carrossel",
        media_type: "CAROUSEL_ALBUM",
        children: { data: [{ id: "c1", media_type: "IMAGE", media_url: "http://img/c1.jpg" }] },
      },
    ];
    const out = preparePostSummaries(posts);
    expect(out.find((s) => s.id === "foto")?.imageUrl).toBe("http://img/foto.jpg");
    // vídeo usa thumbnail, não o .mp4
    expect(out.find((s) => s.id === "video")?.imageUrl).toBe("http://img/v.jpg");
    // carrossel usa a primeira mídia filha
    expect(out.find((s) => s.id === "carrossel")?.imageUrl).toBe("http://img/c1.jpg");
  });

  it("inclui id e extrai hashtags da legenda", () => {
    const out = preparePostSummaries([
      { id: "p1", media_type: "IMAGE", caption: "oi #vida #foco", media_url: "http://i/1.jpg" },
    ]);
    expect(out[0]?.id).toBe("p1");
    expect(out[0]?.hashtags).toEqual(["#vida", "#foco"]);
  });

  it("limita a 60 posts", () => {
    const many: InstagramMedia[] = Array.from({ length: 80 }, (_, i) => ({ id: String(i), media_type: "IMAGE" }));
    expect(preparePostSummaries(many)).toHaveLength(60);
  });
});

describe("selectVisualPosts", () => {
  it("ranqueia por ressonância (saves+shares) desc", () => {
    const summaries = [
      makeSummary({ id: "a" }),
      makeSummary({ id: "b" }),
      makeSummary({ id: "c" }),
    ];
    const resonance = new Map([["a", 5], ["b", 50], ["c", 20]]);
    const out = selectVisualPosts(summaries, resonance, 2);
    expect(out.map((s) => s.id)).toEqual(["b", "c"]);
  });

  it("descarta posts sem imagem", () => {
    const summaries = [
      makeSummary({ id: "a", imageUrl: null }),
      makeSummary({ id: "b" }),
    ];
    const out = selectVisualPosts(summaries, undefined, 5);
    expect(out.map((s) => s.id)).toEqual(["b"]);
  });

  it("sem ressonância, mantém ordem de recência respeitando o limite", () => {
    const summaries = [
      makeSummary({ id: "a" }),
      makeSummary({ id: "b" }),
      makeSummary({ id: "c" }),
    ];
    const out = selectVisualPosts(summaries, undefined, 2);
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
  });

  it("empate de ressonância é estável (mantém recência)", () => {
    const summaries = [makeSummary({ id: "a" }), makeSummary({ id: "b" })];
    const resonance = new Map([["a", 10], ["b", 10]]);
    const out = selectVisualPosts(summaries, resonance, 2);
    expect(out.map((s) => s.id)).toEqual(["a", "b"]);
  });
});

describe("analyzeInstagramPosts", () => {
  it("retorna amostragem insuficiente sem chamar IA com <5 posts", async () => {
    const posts: InstagramMedia[] = Array.from({ length: 3 }, (_, i) => ({ id: String(i), media_type: "IMAGE" }));
    const result = await analyzeInstagramPosts(posts);
    expect(result.amostragem).toBe("insuficiente");
    expect(result.temas_recorrentes).toEqual([]);
  });

  it("classifica amostragem suficiente com 10+ posts (caminho texto em teste)", async () => {
    const posts: InstagramMedia[] = Array.from({ length: 12 }, (_, i) => ({
      id: String(i),
      media_type: "IMAGE",
      caption: `post ${i}`,
    }));
    const result = await analyzeInstagramPosts(posts);
    expect(result.amostragem).toBe("suficiente");
  });
});
