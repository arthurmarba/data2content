import { fireEvent, render, screen } from "@testing-library/react";

import { NarrativeProductCycle } from "./NarrativeProductCycle";

jest.mock("framer-motion", () => {
  const React = require("react");
  const Motion = React.forwardRef(
    ({ children, initial, animate, exit, transition, ...props }: any, ref: any) =>
      React.createElement("div", { ...props, ref }, children),
  );
  Motion.displayName = "MotionMock";

  return {
    AnimatePresence: ({ children }: any) => children,
    motion: new Proxy({}, { get: () => Motion }),
  };
});

describe("NarrativeProductCycle", () => {
  it("expõe tabs e painel conectados por atributos acessíveis", () => {
    render(<NarrativeProductCycle />);

    const tab = screen.getByRole("tab", { name: /Pautas/i });
    fireEvent.click(tab);

    expect(tab).toHaveAttribute("aria-selected", "true");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("aria-labelledby", tab.id);
    expect(screen.getByText(/Cada escolha ensina a inteligência/i)).toBeInTheDocument();
  });

  it("permite percorrer o produto pelo teclado", () => {
    render(<NarrativeProductCycle />);

    const mapTab = screen.getByRole("tab", { name: /Seu Mapa/i });
    mapTab.focus();
    fireEvent.keyDown(mapTab, { key: "ArrowRight" });

    const ideasTab = screen.getByRole("tab", { name: /Pautas/i });
    expect(ideasTab).toHaveFocus();
    expect(ideasTab).toHaveAttribute("aria-selected", "true");

    fireEvent.keyDown(ideasTab, { key: "End" });
    expect(screen.getByRole("tab", { name: /Análise/i })).toHaveFocus();
  });
});
