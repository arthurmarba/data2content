import React from "react";
import { render, screen } from "@testing-library/react";
import { fireEvent } from "@testing-library/react";
import { WeeklyMeetingProfileCard } from "./WeeklyMeetingProfileCard";
import { openPaywallModal } from "@/utils/paywallModal";

jest.mock("@/utils/paywallModal", () => ({ openPaywallModal: jest.fn() }));

const meeting = {
  startAt: "2026-07-23T22:00:00.000Z",
  status: "forecast" as const,
};

describe("WeeklyMeetingProfileCard", () => {
  beforeEach(() => {
    (openPaywallModal as jest.Mock).mockClear();
  });

  it("mostra apenas o grupo Pro ao visitante e abre a assinatura", () => {
    render(<WeeklyMeetingProfileCard isPro={false} meeting={meeting} />);

    expect(screen.getByRole("heading", { name: /Quinta-feira, 23 de julho/ })).toBeInTheDocument();
    expect(screen.getByText(/Assine o Pro para entrar no grupo/)).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Receber avisos/ })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Quinta-feira, 23 de julho/ }).closest("section")).toHaveClass("ds-notebook-section");
    expect(screen.getByRole("link", { name: "Ver reunião" })).toHaveAttribute("href", "/reuniao");
    expect(screen.getByRole("link", { name: "Ver reunião" })).toHaveClass("ds-button", "ds-button--ghost");

    const groupButton = screen.getByRole("button", { name: /Abrir grupo Pro/ });
    expect(groupButton).toHaveClass("ds-button", "ds-button--quiet");
    fireEvent.click(groupButton);

    expect(openPaywallModal).toHaveBeenCalledWith(
      {
        context: "mentoria",
        source: "profile_weekly_meeting_card",
        returnTo: "/dashboard/boards/mobile-strategic-profile",
        postCheckoutIntent: "connect_instagram",
      },
    );
  });

  it("leva o assinante ao grupo Pro e explica a confirmação", () => {
    render(<WeeklyMeetingProfileCard isPro meeting={meeting} />);

    const groupLink = screen.getByRole("link", { name: /Abrir grupo Pro/ });
    expect(groupLink).toHaveAttribute("href", "/api/dashboard/community/pro-join");
    expect(groupLink).toHaveClass("ds-button", "ds-button--primary");
    expect(screen.getByText("Confirme presença no grupo Pro para ser analisado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Abrir grupo Pro/ })).not.toBeInTheDocument();
  });

  it("não apresenta uma edição cancelada como reunião disponível", () => {
    render(
      <WeeklyMeetingProfileCard
        isPro={false}
        meeting={{ ...meeting, status: "cancelled" }}
      />,
    );

    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByText("Cancelada")).toHaveClass("ds-badge", "ds-badge--danger");
    expect(screen.getByRole("heading", { name: "Esta edição foi cancelada" })).toBeInTheDocument();
    expect(screen.queryByText(/Quinta-feira, 23 de julho/)).not.toBeInTheDocument();
  });
});
