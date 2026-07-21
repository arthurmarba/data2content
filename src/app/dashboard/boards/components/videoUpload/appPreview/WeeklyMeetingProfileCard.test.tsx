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
  it("leva o visitante ao canal gratuito de avisos", () => {
    render(<WeeklyMeetingProfileCard isPro={false} meeting={meeting} />);

    expect(screen.getByRole("heading", { name: /Quinta-feira, 23 de julho/ })).toBeInTheDocument();
    expect(screen.getByText(/Assista grátis/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Receber avisos/ })).toHaveAttribute(
      "href",
      "/api/dashboard/community/free-join",
    );
    expect(screen.getByRole("link", { name: "Ver reunião" })).toHaveAttribute("href", "/reuniao");
  });

  it("oferece a conversão para o visitante com a intenção do grupo", () => {
    render(<WeeklyMeetingProfileCard isPro={false} meeting={meeting} />);

    fireEvent.click(screen.getByRole("button", { name: /Conheça o Pro/ }));

    expect(openPaywallModal).toHaveBeenCalledWith(
      expect.objectContaining({ postCheckoutIntent: "join_community" }),
    );
  });

  it("leva o assinante ao grupo Pro e explica a confirmação", () => {
    render(<WeeklyMeetingProfileCard isPro meeting={meeting} />);

    const groupLink = screen.getByRole("link", { name: /Abrir grupo Pro/ });
    expect(groupLink).toHaveAttribute("href", expect.stringContaining("chat.whatsapp.com"));
    expect(screen.getByText("Confirme presença no grupo Pro para ser analisado.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Conheça o Pro/ })).not.toBeInTheDocument();
  });

  it("não apresenta uma edição cancelada como reunião disponível", () => {
    render(
      <WeeklyMeetingProfileCard
        isPro={false}
        meeting={{ ...meeting, status: "cancelled" }}
      />,
    );

    expect(screen.getByText("Cancelada")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Esta edição foi cancelada" })).toBeInTheDocument();
    expect(screen.queryByText(/Quinta-feira, 23 de julho/)).not.toBeInTheDocument();
  });
});
