import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import type { RecordedMeeting } from "@/app/lib/community/recordedMeetingsService";
import RecordedMeetingsLibrary from "./RecordedMeetingsLibrary";

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, sizes: _sizes, ...props }: any) => (
    <img {...props} />
  ),
}));

const meetings: RecordedMeeting[] = [
  {
    id: "meeting-1",
    youtubeVideoId: "video-1",
    title: "Raio X de Conteúdo",
    description: "Uma análise real sobre os padrões por trás dos posts que viralizaram.",
    publishedAt: "2026-08-04T12:00:00.000Z",
    thumbnailUrl: "https://img.youtube.com/vi/video-1/hqdefault.jpg",
  },
  {
    id: "meeting-2",
    youtubeVideoId: "video-2",
    title: "Narrativas que vendem",
    description: "Como transformar assunto e formato em uma direção de conteúdo.",
    publishedAt: "2026-07-28T12:00:00.000Z",
    thumbnailUrl: "https://img.youtube.com/vi/video-2/hqdefault.jpg",
  },
];

describe("RecordedMeetingsLibrary", () => {
  it("apresenta destaque e catálogo com capas 16:9 em alta resolução", () => {
    render(<RecordedMeetingsLibrary meetings={meetings} />);

    expect(screen.getByRole("heading", { name: "Raio X de Conteúdo" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Todos os episódios" })).toBeInTheDocument();
    expect(screen.getAllByAltText("Capa da reunião Raio X de Conteúdo")[0]).toHaveAttribute(
      "src",
      "https://img.youtube.com/vi/video-1/maxresdefault.jpg",
    );
    expect(screen.getByText("2 episódios")).toBeInTheDocument();
  });

  it("abre e fecha o player sem sair da biblioteca", () => {
    render(<RecordedMeetingsLibrary meetings={meetings} />);

    fireEvent.click(screen.getByRole("button", { name: "Assistir agora" }));

    expect(screen.getByRole("dialog", { name: "Assistir Raio X de Conteúdo" })).toBeInTheDocument();
    expect(screen.getByTitle("Raio X de Conteúdo")).toHaveAttribute(
      "src",
      expect.stringContaining("youtube.com/embed/video-1"),
    );

    fireEvent.click(screen.getByRole("button", { name: "Fechar vídeo" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("filtra o catálogo por título", () => {
    render(<RecordedMeetingsLibrary meetings={meetings} />);

    fireEvent.change(screen.getByRole("searchbox", { name: "Buscar reunião" }), {
      target: { value: "narrativas" },
    });

    expect(screen.getByRole("button", { name: "Assistir Narrativas que vendem" })).toBeInTheDocument();
    expect(screen.getAllByRole("button", { name: "Assistir Raio X de Conteúdo" })).toHaveLength(1);
  });
});
