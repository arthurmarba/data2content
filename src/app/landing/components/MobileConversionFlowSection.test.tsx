import React from "react";
import { render, screen } from "@testing-library/react";

import MobileConversionFlowSection from "./MobileConversionFlowSection";

describe("MobileConversionFlowSection", () => {
  it("renders only the gallery bridge on mobile without duplicate metric or category chips", () => {
    render(
      <MobileConversionFlowSection
        categories={[
          {
            id: "beauty",
            label: "Beleza",
            postCount: 20,
            totalInteractions: 1000,
            avgInteractionsPerPost: 50,
            topFormats: [],
            topProposals: [],
          },
        ]}
        creators={[]}
      />,
    );

    expect(screen.queryByTestId("mobile-social-proof")).not.toBeInTheDocument();
    expect(screen.queryByText(/comunidade ativa/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/como funciona na pratica/i)).not.toBeInTheDocument();
    expect(screen.getByTestId("mobile-gallery-bridge")).toBeInTheDocument();
    expect(screen.queryByText(/nossa comunidade/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Criadores")).not.toBeInTheDocument();
    expect(screen.queryByText("Alcance")).not.toBeInTheDocument();
    expect(screen.queryByText("Seguidores")).not.toBeInTheDocument();
    expect(screen.queryByText("Beleza")).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /ver membros da comunidade/i })).toHaveAttribute("href", "#galeria");
  });
});
