import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import type { InstagramMetricsSummary } from "@/app/dashboard/boards/videoUpload/instagramMetricsSummaryService";
import { DiagnosticoInstagramDetailView } from "./DiagnosticoInstagramDetailView";

const FULL_METRICS: InstagramMetricsSummary = {
  avgReachPerPost: 4200,
  avgEngagementRate: 0.072,
  avgReelsDurationSeconds: 36,
  avgReelsWatchTimeSeconds: 14,
  avgReelsViews: 6100,
  avgInteractionsPerPost: 302,
  avgSavesPerPost: 18,
  avgSharesPerPost: 12,
  avgCommentsPerPost: 9,
  avgProfileVisitsPerPost: 44,
  avgFollowsPerPost: 5,
  avgFollowerConversionRate: 0.11,
  avgIntentActionsPerPost: 79,
  topFormats: ["reel", "carrossel"],
  formatPerformance: [
    {
      format: "reel",
      postsCount: 4,
      avgReach: 5100,
      avgEngagementRate: 0.081,
      avgViews: 7200,
      shareOfPosts: 0.67,
    },
    {
      format: "carrossel",
      postsCount: 2,
      avgReach: 2400,
      avgEngagementRate: 0.054,
      avgViews: null,
      shareOfPosts: 0.33,
    },
  ],
  territoryResonance: [
    {
      territory: "career_work",
      label: "Carreira/Trabalho",
      postsCount: 3,
      avgReach: 4200,
      avgSavesPerPost: 320,
      avgSharesPerPost: 140,
      resonanceScore: 460,
    },
    {
      territory: "finance",
      label: "Finanças",
      postsCount: 2,
      avgReach: 3100,
      avgSavesPerPost: 180,
      avgSharesPerPost: 90,
      resonanceScore: 270,
    },
  ],
  weeklyPerformance: [
    { weekStart: "2026-05-03", avgReach: 2800, avgInteractions: 180, postsCount: 1 },
    { weekStart: "2026-05-10", avgReach: 3900, avgInteractions: 250, postsCount: 2 },
    { weekStart: "2026-05-17", avgReach: 6100, avgInteractions: 420, postsCount: 3 },
  ],
  deltas: {
    avgReachPerPost: 0.24,
    avgInteractionsPerPost: 0.18,
    avgEngagementRate: -0.04,
    avgIntentActionsPerPost: 0.31,
  },
  postsAnalyzed: 6,
  sampleWindowDays: 60,
  comparisonWindowDays: 60,
  newestPostDate: "2026-05-20T12:00:00.000Z",
  reachOverTime: [1200, 2100, 0, 3100, 3900, 6100],
  bestDayOfWeek: { dayIndex: 3, dayLabel: "Qua", avgReach: 5800, postCount: 3 },
};

function renderView(overrides: Partial<React.ComponentProps<typeof DiagnosticoInstagramDetailView>> = {}) {
  const props: React.ComponentProps<typeof DiagnosticoInstagramDetailView> = {
    instagramMetrics: FULL_METRICS,
    instagramConnected: true,
    mainNarrativeLabel: "Humor com Identificação",
    onConnectInstagram: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };

  render(<DiagnosticoInstagramDetailView {...props} />);
  return props;
}

describe("DiagnosticoInstagramDetailView", () => {
  it("renders the rich connected summary", () => {
    renderView();

    expect(screen.getByText("Destaques")).toBeInTheDocument();
    expect(screen.getByText("Alcance médio por post")).toBeInTheDocument();
    expect(screen.getByText("Leitura rápida")).toBeInTheDocument();
    expect(screen.getAllByText("Engajamento").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Intenção").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Sinais de intenção")).toBeInTheDocument();
    expect(screen.getByText("Formatos")).toBeInTheDocument();
    expect(screen.getByText("Reels")).toBeInTheDocument();
    expect(screen.getByText("Base analisada")).toBeInTheDocument();
    expect(screen.getByText("Formatos mais usados no período")).toBeInTheDocument();
  });

  it("keeps the page stable with partial metric data", () => {
    renderView({
      instagramMetrics: {
        ...FULL_METRICS,
        avgReelsDurationSeconds: null,
        avgReelsWatchTimeSeconds: null,
        avgReelsViews: null,
        avgSavesPerPost: null,
        avgSharesPerPost: null,
        avgProfileVisitsPerPost: null,
        avgFollowsPerPost: null,
        topFormats: [],
        formatPerformance: [],
      },
    });

    expect(screen.getByText("Destaques")).toBeInTheDocument();
    expect(screen.getByText("Leitura rápida")).toBeInTheDocument();
    expect(screen.getAllByText("Engajamento").length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("Base analisada")).toBeInTheDocument();
    expect(screen.queryByText("Sinais de intenção")).not.toBeInTheDocument();
    expect(screen.queryByText("Formatos")).not.toBeInTheDocument();
    expect(screen.queryByText("Reels")).not.toBeInTheDocument();
  });

  it("shows the Instagram connection CTA when disconnected", () => {
    const onConnectInstagram = jest.fn();
    renderView({
      instagramConnected: false,
      instagramMetrics: null,
      onConnectInstagram,
    });

    expect(screen.getByText("Conecte o Instagram")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conectar Instagram" }));
    expect(onConnectInstagram).toHaveBeenCalledTimes(1);
  });

  it("shows the loading state when connected metrics are not ready", () => {
    renderView({
      instagramConnected: true,
      instagramMetrics: null,
    });

    expect(screen.getByText("Métricas carregando")).toBeInTheDocument();
  });
});
