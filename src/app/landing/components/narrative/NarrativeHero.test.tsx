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
    AnimatePresence: ({ children }: { children: React.ReactNode }) => children,
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
      "Tendências de conteúdo viram direção para ganhar seguidores, engajar, vender, atrair publicidade e criar comunidade.",
    );
    expect(screen.getByText(/Assuntos, falas, cenários, formatos e reações da audiência/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Criar conta grátis/i })).toBeInTheDocument();
    expect(screen.getByText(/Conta gratuita · relatório e reuniões para assinantes/i)).toBeInTheDocument();
    expect(screen.getByText("para")).toHaveClass("d2c-human-hero__outcome-prefix");
    expect(screen.getByText("ganhar seguidores.").tagName).toBe("EM");
    expect(screen.getByText("ganhar seguidores.")).toHaveClass("d2c-human-hero__outcome-word");
  });

  it("expõe os sinais lidos pela D2C como conteúdo, não como decoração", () => {
    render(<NarrativeHero />);

    const signals = screen.getByLabelText(/Sinais que a D2C lê no conteúdo/i);

    expect(signals).toHaveTextContent("CenárioEspaço de trabalho");
    expect(signals).toHaveTextContent("AssuntoIA · negócios criativos");
    expect(signals).toHaveTextContent("FalaEstou construindo do meu jeito");
    expect(signals).toHaveTextContent("TomDireto · pessoal · provocativo");
  });
});
