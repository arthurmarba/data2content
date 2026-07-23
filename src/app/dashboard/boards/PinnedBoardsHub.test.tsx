import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import PinnedBoardsHub from "./PinnedBoardsHub";

describe("PinnedBoardsHub", () => {
  it("centraliza o rail quando existe apenas um board", () => {
    const { container } = render(
      <PinnedBoardsHub>
        <div>Início</div>
      </PinnedBoardsHub>,
    );

    const rail = container.querySelector(".justify-center");
    const scrollContainer = container.querySelector(".overflow-x-hidden");

    expect(rail).not.toBeNull();
    expect(scrollContainer).not.toBeNull();
    expect(screen.getByText("Início")).toBeInTheDocument();
  });

  it("mantém trilha horizontal quando há múltiplos boards", () => {
    const { container } = render(
      <PinnedBoardsHub>
        <div>Início</div>
        <div>Campanhas</div>
      </PinnedBoardsHub>,
    );

    const rail = container.querySelector(".min-w-max");
    const scrollContainer = container.querySelector(".overflow-x-auto");

    expect(rail).not.toBeNull();
    expect(scrollContainer).not.toBeNull();
    expect(screen.getByText("Campanhas")).toBeInTheDocument();
  });

  it("expõe controles e o nome do painel ativo quando recebe labels", () => {
    const { container } = render(
      <PinnedBoardsHub navigationLabels={["Campanhas", "Comunidade"]}>
        <div>Inbox comercial</div>
        <div>Feed de creators</div>
      </PinnedBoardsHub>,
    );
    const scrollContainer = container.querySelector(".overflow-x-auto") as HTMLDivElement;
    scrollContainer.scrollTo = jest.fn();

    expect(screen.getByText("1 / 2 · Campanhas")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Painel anterior" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Próximo painel" }));

    expect(scrollContainer.scrollTo).toHaveBeenCalled();
    expect(screen.getByText("2 / 2 · Comunidade")).toBeInTheDocument();
  });
});
