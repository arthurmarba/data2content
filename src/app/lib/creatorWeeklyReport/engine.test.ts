import { lastClosedWeek } from "@/app/lib/relatorio/weekWindow";
import { buildCreatorWeeklyReport } from "./engine";

function metric(params: {
  date: string;
  shares: number;
  saved?: number;
  views?: number;
  subject?: string;
  opening?: string;
  place?: string;
  objects?: string[];
  cast?: string[];
  framing?: string[];
  aesthetics?: string[];
}) {
  return {
    instagramMediaId: params.date,
    postDate: new Date(params.date),
    updatedAt: new Date("2026-08-10T10:00:00Z"),
    stats: {
      shares: params.shares,
      saved: params.saved ?? params.shares * 2,
      views: params.views ?? params.shares * 100,
    },
    sceneElements: params.subject
      ? {
          version: "v1",
          subjects: [params.subject],
          openingLine: params.opening ?? null,
          toneIds: [],
          placeId: params.place ?? null,
          objects: params.objects ?? [],
          assetRoleIds: params.cast ?? [],
          framingIds: params.framing ?? [],
          aestheticIds: params.aesthetics ?? [],
        }
      : null,
  };
}

describe("buildCreatorWeeklyReport", () => {
  const week = lastClosedWeek(new Date("2026-08-10T12:00:00Z"));

  it("compara padrões com a mediana da própria conta e registra cobertura", () => {
    const report = buildCreatorWeeklyReport({
      week,
      generatedAt: new Date("2026-08-10T12:00:00Z"),
      metrics: [
        metric({ date: "2026-08-03T09:00:00Z", shares: 10, subject: "Rotina real", opening: "Hoje deu tudo errado." }),
        metric({ date: "2026-08-04T09:00:00Z", shares: 20, subject: "Rotina real", opening: "Eu não esperava por isso." }),
        metric({ date: "2026-08-05T21:00:00Z", shares: 5, subject: "Autocuidado", opening: "Três dicas rápidas." }),
        metric({ date: "2026-07-20T09:00:00Z", shares: 5 }),
      ],
    });

    expect(report.weekKey).toBe("2026-W32");
    expect(report.coverage).toEqual(expect.objectContaining({ posts90d: 4, postsWeek: 3, postsWithScene: 3 }));
    expect(report.weeklyVideo?.shares).toBe(20);
    expect(report.details.find((detail) => detail.id === "subjects")?.groups[0]?.items[0]).toEqual(
      expect.objectContaining({ label: "Rotina real", nPosts: 2 }),
    );
  });

  it("não inventa rankings visuais quando não existe leitura de cena", () => {
    const report = buildCreatorWeeklyReport({
      week,
      metrics: [metric({ date: "2026-08-04T10:00:00Z", shares: 3 })],
    });

    expect(report.status).toBe("partial");
    expect(report.coverage.postsWithScene).toBe(0);
    expect(report.details.find((detail) => detail.id === "scene")?.groups).toEqual([]);
    expect(report.details.find((detail) => detail.id === "openings")?.groups).toEqual([]);
  });

  it("ranqueia objeto de cena, elenco, enquadramento e clima — não só cenário e tom", () => {
    const report = buildCreatorWeeklyReport({
      week,
      generatedAt: new Date("2026-08-10T12:00:00Z"),
      metrics: [
        metric({
          date: "2026-08-04T09:00:00Z",
          shares: 30,
          subject: "Rotina real",
          objects: ["Caneca de café"],
          cast: ["parceiro_em_cena"],
          framing: ["close"],
          aesthetics: ["luz_natural"],
        }),
        metric({
          date: "2026-08-05T09:00:00Z",
          shares: 20,
          subject: "Rotina real",
          objects: ["Caneca de café"],
          cast: ["parceiro_em_cena"],
          framing: ["close"],
          aesthetics: ["luz_natural"],
        }),
        metric({ date: "2026-08-06T09:00:00Z", shares: 2, subject: "Autocuidado" }),
      ],
    });

    const scene = report.details.find((detail) => detail.id === "scene");
    const groupIds = scene?.groups.map((group) => group.id) ?? [];
    expect(groupIds).toEqual(expect.arrayContaining(["objects", "cast", "framing", "aesthetics"]));
    expect(scene?.groups.find((group) => group.id === "objects")?.items[0]?.label).toBe("Caneca de café");
    // Elenco pelo papel canônico, nunca pelo nome de quem aparece.
    expect(scene?.groups.find((group) => group.id === "cast")?.items[0]?.label).not.toBe("parceiro_em_cena");
  });
});
