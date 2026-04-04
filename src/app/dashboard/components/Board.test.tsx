import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";

import Board from "./Board";

function mockScrollableMetrics(element: HTMLElement, metrics: { clientHeight: number; scrollHeight: number; scrollTop?: number }) {
  Object.defineProperty(element, "clientHeight", {
    configurable: true,
    value: metrics.clientHeight,
  });
  Object.defineProperty(element, "scrollHeight", {
    configurable: true,
    value: metrics.scrollHeight,
  });
  Object.defineProperty(element, "scrollTop", {
    configurable: true,
    writable: true,
    value: metrics.scrollTop ?? 0,
  });
}

describe("Board", () => {
  it("encaminha o wheel do header para o container rolável do board", () => {
    const { container } = render(
      <Board title="Início" variant="card">
        <div style={{ height: 1200 }}>Conteúdo longo</div>
      </Board>,
    );

    const scrollContainer = container.querySelector("[data-board-scroll-container='true']") as HTMLDivElement;
    mockScrollableMetrics(scrollContainer, {
      clientHeight: 240,
      scrollHeight: 1200,
      scrollTop: 0,
    });

    fireEvent.wheel(screen.getByText("Início"), { deltaY: 180 });

    expect(scrollContainer.scrollTop).toBe(180);
  });

  it("não intercepta wheel disparado dentro do próprio container rolável", () => {
    const { container } = render(
      <Board title="Início" variant="card">
        <div style={{ height: 1200 }}>Conteúdo longo</div>
      </Board>,
    );

    const scrollContainer = container.querySelector("[data-board-scroll-container='true']") as HTMLDivElement;
    mockScrollableMetrics(scrollContainer, {
      clientHeight: 240,
      scrollHeight: 1200,
      scrollTop: 0,
    });

    fireEvent.wheel(scrollContainer, { deltaY: 180 });

    expect(scrollContainer.scrollTop).toBe(0);
  });
});
