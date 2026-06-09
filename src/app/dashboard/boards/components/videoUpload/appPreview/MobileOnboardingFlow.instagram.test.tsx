/**
 * O3 — retomada do onboarding + conexão de Instagram (novo fluxo).
 *
 * No novo fluxo a tela "welcome" foi eliminada: a entrada é o step fundido
 * `questions`. Steps legados (welcome/question_1/2/3/instagram) passados via
 * `initialStep` são mapeados para `questions` (retomada após redirect OAuth).
 * A conexão de Instagram acontece no step `instagram_invite` (pós first_signal).
 *
 * Cobre:
 *   1. Sem initialStep → abre direto em `questions` (sem welcome).
 *   2. initialStep legado ("question_1") → mapeado para `questions`.
 *   3. No `instagram_invite`, "Conectar Instagram" chama onConnectInstagram quando fornecido.
 *   4. Sem onConnectInstagram → usa window.location.href como fallback (contém "instagram").
 */
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MobileOnboardingFlow } from "./MobileOnboardingFlow";

// framer-motion: renderiza children direto (AnimatePresence mode="wait" não
// completa a animação de saída em jsdom).
jest.mock("framer-motion", () => {
  const ReactMod = require("react");
  const stripAnimationProps = (props: Record<string, unknown>) => {
    const {
      initial, animate, exit, transition, variants,
      whileHover, whileTap, whileInView, layout, layoutId,
      ...rest
    } = props;
    return rest;
  };
  return {
    __esModule: true,
    AnimatePresence: ({ children }: { children: React.ReactNode }) =>
      ReactMod.createElement(ReactMod.Fragment, null, children),
    motion: new Proxy(
      {},
      {
        get: (_t, tag: string) =>
          ReactMod.forwardRef((props: Record<string, unknown>, ref: unknown) =>
            ReactMod.createElement(tag, { ref, ...stripAnimationProps(props) }, (props as { children?: React.ReactNode }).children),
          ),
      },
    ),
  };
});

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

const defaultProps = {
  open: true,
  instagramConnected: false,
  accessState: "free_unused" as const,
  onComplete: jest.fn(),
};

const QUESTIONS_HEADING = "O que define o que você cria?";
const INSTAGRAM_HEADING = "Seu Instagram já tem os sinais que o mapa precisa.";

describe("MobileOnboardingFlow — O3: retomada + conexão de Instagram (novo fluxo)", () => {
  it("sem initialStep: abre direto em questions (sem welcome)", () => {
    render(<MobileOnboardingFlow {...defaultProps} />);
    expect(screen.getByText(QUESTIONS_HEADING)).toBeInTheDocument();
    // Entrada do fluxo → sem botão Voltar.
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
  });

  it("initialStep legado ('question_1') é mapeado para questions", () => {
    render(<MobileOnboardingFlow {...defaultProps} initialStep="question_1" />);
    expect(screen.getByText(QUESTIONS_HEADING)).toBeInTheDocument();
  });

  it("instagram_invite: 'Conectar Instagram' chama onConnectInstagram quando fornecido", () => {
    const onConnect = jest.fn();
    render(
      <MobileOnboardingFlow
        {...defaultProps}
        accessState="pro_needs_instagram"
        onConnectInstagram={onConnect}
        initialStep="instagram_invite"
      />,
    );
    expect(screen.getByText(INSTAGRAM_HEADING)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Conectar Instagram"));
    expect(onConnect).toHaveBeenCalledTimes(1);
  });

  it("sem onConnectInstagram: 'Conectar Instagram' usa window.location.href como fallback", () => {
    const originalHref = window.location.href;
    Object.defineProperty(window, "location", {
      writable: true,
      value: { href: originalHref },
    });

    render(
      <MobileOnboardingFlow
        {...defaultProps}
        accessState="pro_needs_instagram"
        initialStep="instagram_invite"
      />,
    );

    fireEvent.click(screen.getByText("Conectar Instagram"));
    expect(window.location.href).toContain("instagram");
  });
});
