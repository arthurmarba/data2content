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
  it("apresenta a promessa inteira no h1 e o CTA da primeira dobra", () => {
    render(<NarrativeHero />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      "Seus posts revelam o que sua audiência quer. A gente te diz o que postar.",
    );
    expect(screen.getByRole("button", { name: /Criar conta grátis/i })).toBeInTheDocument();
    expect(screen.queryByText(/Para criadores, marcas e prestadores de serviço/i)).not.toBeInTheDocument();
  });

  it("expõe as sugestões lidas pela D2C como conteúdo, não como decoração", () => {
    render(<NarrativeHero />);

    const signals = screen.getByLabelText(/Exemplo de análise da D2C/i);

    /* A lista completa vive no rótulo acessível: só uma sugestão aparece
       por vez na tela, mas nenhuma pode ficar invisível para quem não vê. */
    expect(signals).toHaveAccessibleName(
      expect.stringContaining("Gravar o vídeo dentro de casa — 2,3× em comentários"),
    );
    expect(signals).toHaveAccessibleName(
      expect.stringContaining("Postar na quarta de manhã — 7,9× em compartilhamentos"),
    );
    expect(signals).toHaveTextContent("Gravar o vídeo");
  });
});
