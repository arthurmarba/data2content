import React from "react";
import { render, screen } from "@testing-library/react";

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
});
