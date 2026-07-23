import React, { useEffect } from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import CampaignsBoard from "./CampaignsBoard";

jest.mock("@/app/dashboard/hooks/useBoardMobileViewport", () => ({
  __esModule: true,
  default: () => false,
}));

jest.mock("@/app/dashboard/proposals/ProposalsClient", () => ({
  __esModule: true,
  default: ({
    onNewCountChange,
  }: {
    onNewCountChange?: (count: number) => void;
  }) => {
    useEffect(() => {
      onNewCountChange?.(2);
    }, [onNewCountChange]);
    return <div>Inbox de propostas</div>;
  },
}));

jest.mock("@/app/dashboard/publis/PublisClient", () => ({
  __esModule: true,
  default: () => <div>Área de publis</div>,
}));

jest.mock("@/app/dashboard/calculator/CalculatorClient", () => ({
  __esModule: true,
  default: () => <div>Área da calculadora</div>,
}));

describe("CampaignsBoard", () => {
  it("apresenta Campanhas como caixa de entrada comercial", async () => {
    render(<CampaignsBoard showTitleMarker={false} />);

    expect(screen.getByRole("heading", { name: "Campanhas" })).toBeInTheDocument();
    expect(
      screen.getByText(
        "Acompanhe propostas, leia briefings e responda às marcas em um só lugar."
      )
    ).toBeInTheDocument();
    expect(
      screen.getByRole("tab", { name: /Propostas recebidas/i })
    ).toHaveAttribute("aria-selected", "true");
    expect(await screen.findByLabelText("2 novas propostas")).toBeInTheDocument();
    expect(screen.getByText("Inbox de propostas")).toBeInTheDocument();
  });

  it("mantém Publis e Calculadora como áreas secundárias", () => {
    render(<CampaignsBoard showTitleMarker={false} />);

    fireEvent.click(screen.getByRole("tab", { name: "Publis" }));
    expect(screen.getByText("Área de publis")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("tab", { name: "Calculadora" }));
    expect(screen.getByText("Área da calculadora")).toBeInTheDocument();
  });
});
