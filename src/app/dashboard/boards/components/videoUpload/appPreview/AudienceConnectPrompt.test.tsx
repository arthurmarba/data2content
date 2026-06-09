import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { AudienceConnectPrompt } from "./AudienceInsightsCard";

describe("AudienceConnectPrompt", () => {
  it("mantém a presença do card de Audiência com header e próximo passo", () => {
    render(<AudienceConnectPrompt onConnectInstagram={jest.fn()} />);
    expect(screen.getByText("Sua Audiência")).toBeInTheDocument();
    expect(screen.getByText("Conectar Instagram")).toBeInTheDocument();
  });

  it("dispara onConnectInstagram ao clicar no CTA", () => {
    const onConnect = jest.fn();
    render(<AudienceConnectPrompt onConnectInstagram={onConnect} />);
    fireEvent.click(screen.getByText("Conectar Instagram"));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("não quebra sem handler (CTA presente, clique no-op)", () => {
    render(<AudienceConnectPrompt />);
    const cta = screen.getByText("Conectar Instagram");
    expect(() => fireEvent.click(cta)).not.toThrow();
  });
});
