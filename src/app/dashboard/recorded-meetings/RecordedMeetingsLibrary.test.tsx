import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import type { RecordedMeetingCatalogItem } from "@/app/lib/community/recordedMeetingsService";
import { openPaywallModal } from "@/utils/paywallModal";
import RecordedMeetingsLibrary from "./RecordedMeetingsLibrary";

jest.mock("@/utils/paywallModal", () => ({ openPaywallModal: jest.fn() }));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, sizes: _sizes, ...props }: any) => (
    <img {...props} />
  ),
}));

const meetings: RecordedMeetingCatalogItem[] = [
  {
    id: "meeting-1",
    title: "Raio X de Conteúdo",
    description: "Uma análise real sobre os padrões por trás dos posts que viralizaram.",
    publishedAt: "2026-08-04T12:00:00.000Z",
    thumbnailUrl: "/api/dashboard/recorded-meetings/meeting-1/thumbnail",
  },
  {
    id: "meeting-2",
    title: "Narrativas que vendem",
    description: "Como transformar assunto e formato em uma direção de conteúdo.",
    publishedAt: "2026-07-28T12:00:00.000Z",
    thumbnailUrl: "/api/dashboard/recorded-meetings/meeting-2/thumbnail",
  },
];

/** Lista longa o bastante para a busca aparecer. */
function manyMeetings(): RecordedMeetingCatalogItem[] {
  return Array.from({ length: 8 }, (_, index) => ({
    ...(meetings[index % meetings.length] as RecordedMeetingCatalogItem),
    id: `meeting-${index}`,
    thumbnailUrl: `/api/dashboard/recorded-meetings/meeting-${index}/thumbnail`,
  }));
}

describe("RecordedMeetingsLibrary", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        ok: true,
        meeting: { ...meetings[0], youtubeVideoId: "video-1" },
      }),
    } as Response);
  });

  it("apresenta destaque e catálogo com capas 16:9 em alta resolução", () => {
    render(<RecordedMeetingsLibrary meetings={meetings} hasPlaybackAccess />);

    expect(screen.getByRole("heading", { name: "Raio X de Conteúdo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Todas as reuniões" })).toBeInTheDocument();
    expect(screen.getAllByAltText("Capa da reunião Raio X de Conteúdo")[0]).toHaveAttribute(
      "src",
      "/api/dashboard/recorded-meetings/meeting-1/thumbnail",
    );
    expect(screen.getByText("2 reuniões")).toBeInTheDocument();
  });

  it("só mostra a busca quando a lista deixa de caber na rolagem", () => {
    const { unmount } = render(<RecordedMeetingsLibrary meetings={meetings} hasPlaybackAccess />);
    expect(screen.queryByRole("searchbox", { name: "Buscar reunião" })).not.toBeInTheDocument();
    unmount();

    render(<RecordedMeetingsLibrary meetings={manyMeetings()} hasPlaybackAccess />);
    expect(screen.getByRole("searchbox", { name: "Buscar reunião" })).toBeInTheDocument();
  });

  it("abre e fecha o player autorizado sem sair da biblioteca", async () => {
    render(<RecordedMeetingsLibrary meetings={meetings} hasPlaybackAccess />);

    fireEvent.click(screen.getByRole("button", { name: "Assistir agora" }));

    expect(await screen.findByRole("dialog", { name: "Assistir Raio X de Conteúdo" })).toBeInTheDocument();
    expect(screen.getByTitle("Raio X de Conteúdo")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube.com/embed/video-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar vídeo" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("abre o paywall real ao tocar em uma gravação no estado Free", () => {
    render(<RecordedMeetingsLibrary meetings={meetings} hasPlaybackAccess={false} />);

    fireEvent.click(screen.getByRole("button", { name: "Assistir agora" }));

    expect(openPaywallModal).toHaveBeenCalledWith({
      context: "recorded_meetings",
      source: "recorded_meetings_featured",
      returnTo: "/reunioes-gravadas?meeting=meeting-1",
      postCheckoutIntent: "watch_recorded_meeting",
    });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("filtra o catálogo por título", () => {
    render(<RecordedMeetingsLibrary meetings={manyMeetings()} hasPlaybackAccess />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar reunião" }), {
      target: { value: "narrativas" },
    });

    expect(screen.getAllByRole("button", { name: "Assistir Narrativas que vendem" }).length).toBeGreaterThan(0);
    // Sobra só o destaque, que fica fora do filtro.
    expect(screen.getAllByRole("button", { name: "Assistir Raio X de Conteúdo" })).toHaveLength(1);
  });
});
