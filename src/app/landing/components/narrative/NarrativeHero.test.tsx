import { render, screen } from "@testing-library/react";

import { NarrativeHero } from "./NarrativeHero";

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, fill: _fill, priority: _priority, ...props }: any) => <img alt={alt} {...props} />,
}));

jest.mock("lucide-react", () => ({
  ArrowRight: () => <svg aria-hidden="true" />,
}));

jest.mock("framer-motion", () => {
  const React = require("react");

  const motion = new Proxy({}, {
    get: (_target, tag: string) => {
      const Component = React.forwardRef(
        ({ children, initial, animate, variants, transition, style: _style, ...props }: any, ref: any) =>
          React.createElement(tag, { ...props, ref }, children),
      );
      Component.displayName = `MotionMock(${tag})`;
      return Component;
    },
  });

  return {
    motion,
    useReducedMotion: () => true,
    useScroll: () => ({ scrollYProgress: 0 }),
    useTransform: (_value: unknown, _input: unknown, output: unknown[]) => output[0],
  };
});

jest.mock("./LandingAuthCta", () => ({
  LandingAuthCta: ({ guestLabel, childrenAfter }: { guestLabel: string; childrenAfter?: React.ReactNode }) => (
    <button type="button">{guestLabel}{childrenAfter}</button>
  ),
}));

describe("NarrativeHero", () => {
  it("apresenta a promessa, o CTA e a copy de apoio definidos para a primeira dobra", () => {
    render(<NarrativeHero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Te ajudamos a criarpra atrair marcas.",
    );
    expect(screen.getByText(/Marcas compram narrativas\. Na D2C/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar na D2C/i })).toBeInTheDocument();
  });

  it("expõe as dimensões do Seu Mapa como conteúdo, não como decoração", () => {
    render(<NarrativeHero />);

    const map = screen.getByLabelText(/Elementos que formam o Seu Mapa/i);

    expect(map).toHaveTextContent("TerritórioCriatividade sem fórmulas");
    expect(map).toHaveTextContent("AssuntosIA · negócios criativos");
    expect(map).toHaveTextContent("Asset de vidaBastidores de quem constrói");
    expect(map).toHaveTextContent("Tom de falaDireto · pessoal · provocativo");
  });
});
