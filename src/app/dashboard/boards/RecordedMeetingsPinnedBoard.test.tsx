import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import RecordedMeetingsPinnedBoard from "./RecordedMeetingsPinnedBoard";
import { openPaywallModal } from "@/utils/paywallModal";

const mockPush = jest.fn();
const mockBilling = {
  hasPremiumAccess: true,
  hasResolvedOnce: true,
};

jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ fill: _fill, priority: _priority, sizes: _sizes, ...props }: any) => (
    <img {...props} />
  ),
}));

jest.mock("@/app/hooks/useBillingStatus", () => ({
  __esModule: true,
  default: () => mockBilling,
}));

jest.mock("@/utils/paywallModal", () => ({ openPaywallModal: jest.fn() }));

jest.mock("@/app/dashboard/components/Board", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe("RecordedMeetingsPinnedBoard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBilling.hasPremiumAccess = true;
    mockBilling.hasResolvedOnce = true;
    global.fetch = jest.fn().mockImplementation((input: RequestInfo | URL) => {
      const meeting = {
        id: "meeting-1",
        title: "Raio X de Conteúdo",
        description: "Padrões e decisões práticas para o próximo conteúdo.",
        publishedAt: "2026-08-04T12:00:00.000Z",
        thumbnailUrl: "/api/dashboard/recorded-meetings/meeting-1/thumbnail",
      };
      const payload = String(input).endsWith("/playback")
        ? { ok: true, meeting: { ...meeting, youtubeVideoId: "video-1" } }
        : { ok: true, meetings: [meeting] };
      return Promise.resolve({ ok: true, json: async () => payload } as Response);
    });
  });

  it("mostra informações da última reunião e permite assistir no board", async () => {
    render(<RecordedMeetingsPinnedBoard />);

    await waitFor(() => expect(screen.getByText("Raio X de Conteúdo")).toBeInTheDocument());
    expect(screen.getByText("Padrões e decisões práticas para o próximo conteúdo.")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Assistir" }));

    expect(await screen.findByRole("dialog", { name: "Assistir Raio X de Conteúdo" })).toBeInTheDocument();
    expect(mockPush).not.toHaveBeenCalled();
  });

  it("mostra a gravação ao Free e abre o modal real ao tocar", async () => {
    mockBilling.hasPremiumAccess = false;
    render(<RecordedMeetingsPinnedBoard />);

    await waitFor(() => expect(screen.getByText("Raio X de Conteúdo")).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: "Assistir" }));

    expect(openPaywallModal).toHaveBeenCalledWith({
      context: "recorded_meetings",
      source: "recorded_meetings_board",
      returnTo: "/reunioes-gravadas?meeting=meeting-1",
      postCheckoutIntent: "watch_recorded_meeting",
    });
  });

  it("mantém a biblioteca como ação secundária", async () => {
    render(<RecordedMeetingsPinnedBoard />);

    await waitFor(() => expect(screen.getByRole("button", { name: /Biblioteca/i })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("button", { name: /Biblioteca/i }));

    expect(mockPush).toHaveBeenCalledWith("/reunioes-gravadas");
  });
});
