import { fireEvent, render, screen } from "@testing-library/react";

import { track } from "@/lib/track";

import CampaignPriorityNotice from "./CampaignPriorityNotice";

jest.mock("@/lib/track", () => ({
  track: jest.fn(),
}));

describe("CampaignPriorityNotice", () => {
  it("mostra uma proposta nova com CTA para Campanhas", () => {
    render(<CampaignPriorityNotice count={1} />);

    expect(
      screen.getByText("Você recebeu uma nova proposta de campanha"),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Ver briefing e responder/i }),
    ).toHaveAttribute("href", "/campaigns?source=home_alert");

    fireEvent.click(screen.getByRole("link", { name: /Ver briefing e responder/i }));
    expect(track).toHaveBeenCalledWith("campaigns_entry_clicked", {
      creator_id: null,
      source: "home_alert",
      unread_count: 1,
    });
  });

  it("inclui o creatorId no evento quando fornecido", () => {
    render(<CampaignPriorityNotice count={2} creatorId="creator-123" />);

    fireEvent.click(screen.getByRole("link", { name: /Ver briefing e responder/i }));
    expect(track).toHaveBeenCalledWith("campaigns_entry_clicked", {
      creator_id: "creator-123",
      source: "home_alert",
      unread_count: 2,
    });
  });

  it("chama onDismiss ao clicar em dispensar", () => {
    const onDismiss = jest.fn();
    render(<CampaignPriorityNotice count={1} onDismiss={onDismiss} />);

    fireEvent.click(
      screen.getByRole("button", { name: /Dispensar aviso de novas propostas/i }),
    );
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("não mostra botão de dispensar sem onDismiss", () => {
    render(<CampaignPriorityNotice count={1} />);
    expect(
      screen.queryByRole("button", { name: /Dispensar aviso/i }),
    ).not.toBeInTheDocument();
  });

  it("não ocupa espaço quando não há propostas novas", () => {
    const { container } = render(<CampaignPriorityNotice count={0} />);
    expect(container).toBeEmptyDOMElement();
  });
});
