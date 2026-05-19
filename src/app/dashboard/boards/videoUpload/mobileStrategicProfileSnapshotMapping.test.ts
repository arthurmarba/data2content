import {
  mapSnapshotToDiagnosisPresentation,
  buildMobileStrategicProfileFromSnapshot,
} from "./mobileStrategicProfileSnapshotMapping";
import type { MobileStrategicProfileSnapshotPayload } from "./mobileStrategicProfileSnapshotTypes";
import { buildMobileStrategicProfile } from "./mobileStrategicProfileMapping";

describe("mobileStrategicProfileSnapshotMapping", () => {
  const mockSnapshot: MobileStrategicProfileSnapshotPayload = {
    schemaVersion: "mobile_strategic_profile_snapshot_v1",
    profileState: "active",
    unlockedSignals: ["Narrativa Clara", "Engajamento Forte"],
    pendingSignals: ["Consistência Semanal"],
    recurringPatterns: ["Estrutura em 3 atos", "Gancho dinâmico"],
    opportunities: ["Território de beleza", "Território de skincare"],
    diagnosisSummary: "Resumo do diagnóstico",
    commercialSummary: "Resumo comercial",
    lastAnalysisSummary: "Resumo do último vídeo analisado",
  };

  const PROHIBITED_WORDS = [
    "score",
    "nota",
    "pontos",
    "ranking",
    "gabarito",
    "garantido",
    "certeza",
    "comprovado",
    "viralizar garantido",
    "match real",
    "marca garantida",
    "patrocínio garantido",
    "vídeos salvos",
    "histórico de vídeos",
    "novo Mídia Kit",
    "Mídia Kit mobile",
    "18 sinais",
    "3 narrativas",
    "percentual de perfil",
  ];

  describe("mapSnapshotToDiagnosisPresentation", () => {
    it("converte o snapshot em uma apresentação estruturada", () => {
      const presentation = mapSnapshotToDiagnosisPresentation(mockSnapshot);

      expect(presentation.id).toBe("snapshot-diagnosis");
      expect(presentation.hero.subtitle).toBe("Resumo do diagnóstico");
      expect(presentation.priorityCards).toHaveLength(2);
      expect(presentation.priorityCards[0].body).toBe("Estrutura em 3 atos");

      // Verifica se a seção de sinais pendentes contém cartões bloqueados
      const pendingSection = presentation.sections.find((s) => s.id === "pending_signals");
      expect(pendingSection).toBeDefined();
      expect(pendingSection?.cards[0].locked).toBe(true);
    });
  });

  describe("buildMobileStrategicProfileFromSnapshot", () => {
    it("mantém fallback construction/account_only se não houver snapshot", () => {
      const input = buildMobileStrategicProfileFromSnapshot({
        sessionUser: {
          name: "João Creator",
          email: "joao@d2c.com",
          instagramConnected: false,
        },
        snapshotPayload: null,
      });

      expect(input.state.profileAvailability).toBe("construction");
      expect(input.diagnosisPresentation).toBeUndefined();

      const profile = buildMobileStrategicProfile(input);
      expect(profile.constructionState.visible).toBe(true);
    });

    it("gera perfil enriquecido com dados do snapshot ativo", () => {
      const input = buildMobileStrategicProfileFromSnapshot({
        sessionUser: {
          name: "João Creator",
          email: "joao@d2c.com",
          instagramConnected: true,
          instagramUsername: "@joao.creator",
        },
        snapshotPayload: mockSnapshot,
        accessLevel: "instagram_optimized",
      });

      expect(input.state.profileAvailability).toBe("active");
      expect(input.state.diagnosisState).toBe("instagram_optimized");
      expect(input.diagnosisPresentation).toBeDefined();

      const profile = buildMobileStrategicProfile(input);
      expect(profile.constructionState.visible).toBe(false);

      // Garante que o snapshot é privado e não cria histórico visual de vídeos
      const serializedProfile = JSON.stringify(profile);
      expect(serializedProfile).not.toContain("videoHistory");
      expect(serializedProfile).not.toContain("analyzedVideos");

      // Garante que o perfil mapeado não usa nenhuma palavra proibida
      for (const word of PROHIBITED_WORDS) {
        expect(serializedProfile.toLowerCase()).not.toContain(word.toLowerCase());
      }
    });
  });
});
