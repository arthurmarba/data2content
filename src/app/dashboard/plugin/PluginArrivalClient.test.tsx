import { fireEvent, render, screen } from "@testing-library/react";

import { track } from "@/lib/track";
import { openPaywallModal } from "@/utils/paywallModal";
import { PluginArrivalClient } from "./PluginArrivalClient";

jest.mock("@/lib/track", () => ({ track: jest.fn() }));
jest.mock("@/utils/paywallModal", () => ({ openPaywallModal: jest.fn() }));

const baseData = {
  accessLevel: "free" as const,
  instagramConnected: false,
  narrative: "Sustento a casa e não quero perder a infância dela",
  territories: ["Maternidade", "Rotina"],
  narrativeIsFirm: false,
  ideas: [{ id: "i1", title: "O café que esfria enquanto ela acorda", territory: "Maternidade", hook: "Todo dia o mesmo café" }],
  ideasState: "ready" as const,
};

describe("tela de chegada do plugin", () => {
  beforeEach(() => jest.clearAllMocks());

  it("mostra narrativa, pautas e o que o Pro inclui para quem pediu pautas", () => {
    render(<PluginArrivalClient client="claude" intent="pautas" data={baseData} returnUrl="https://claude.ai/new" />);

    expect(screen.getByText("Data2Content + Claude")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: baseData.narrative })).toBeInTheDocument();
    expect(screen.getByText("O café que esfria enquanto ela acorda")).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")[3]).toHaveTextContent("Pautas novas toda semana");
    expect(screen.getByRole("link", { name: "Voltar ao Claude" })).toHaveAttribute("href", "https://claude.ai/new");
    expect(track).toHaveBeenCalledWith("claude_funnel_event", expect.objectContaining({ step: "offer_viewed", status: "pautas" }));
  });

  it("abre os planos com a origem do chat e pede o Instagram antes quando a pessoa queria análise", () => {
    render(<PluginArrivalClient client="chatgpt" intent="analise" data={baseData} returnUrl={null} />);

    expect(screen.getByText("A análise dos seus posts")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Ver planos" }));
    expect(openPaywallModal).toHaveBeenCalledWith({
      context: "chatgpt_intelligence",
      source: "chatgpt_profile_upgrade",
      returnTo: "/dashboard/chatgpt/ready",
      postCheckoutIntent: "connect_instagram",
    });
    expect(screen.queryByRole("link", { name: "Voltar ao ChatGPT" })).toBeNull();
  });

  it("explica a espera quando as pautas ainda estão sendo preparadas", () => {
    render(
      <PluginArrivalClient
        client="claude"
        intent={null}
        data={{ ...baseData, ideas: [], ideasState: "preparing" }}
        returnUrl="https://claude.ai/new"
      />,
    );
    expect(screen.getByText(/primeiras pautas estão sendo preparadas/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Atualizar" })).toBeInTheDocument();
  });
});
