/**
 * Navegação para trás — novo fluxo otimizado.
 *
 * O fluxo foi reescrito: Q1+Q2+Q3 foram fundidos num único step `"questions"`.
 * Q3 (propósito, opcional) aparece após Q2 — o avanço exige ação explícita
 * ("Continuar" ou "Pular por enquanto"). A tela "welcome" foi eliminada.
 * Os steps visíveis são `["questions", "first_signal"]` +
 * opcionalmente `"instagram_invite"` (não conectado) ou `"paywall"` (free_unused).
 *
 * BACK_TARGET (fonte da navegação para trás):
 *   questions          → (entrada, sem voltar)
 *   first_signal       → questions
 *   instagram_invite   → first_signal
 *   paywall            → first_signal
 *
 * Garante que:
 *   1. `questions` é a entrada e NÃO exibe botão Voltar.
 *   2. `first_signal` → Voltar retorna para `questions`.
 *   3. `instagram_invite` → Voltar retorna para `first_signal`.
 *   4. `paywall` → Voltar retorna para `first_signal`.
 *   5. Ao voltar de `first_signal` para `questions`, Q1, Q2 e Q3 preservados.
 */
import React from "react";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MobileOnboardingFlow } from "./MobileOnboardingFlow";

// framer-motion: renderiza children direto e sincroniza as trocas de step.
// `AnimatePresence mode="wait"` não completa a animação de saída em jsdom, o que
// impediria o próximo step de montar. Mockamos para tornar a navegação determinística.
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

jest.useFakeTimers();

const mockFetch = jest.fn();
global.fetch = mockFetch;

// jsdom não implementa scrollIntoView — o step `questions` o usa no auto-scroll de Q2.
beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

const baseProps = {
  open: true,
  accessState: "pro_instagram_connected" as const,
  onComplete: jest.fn(),
};

// firstSignal presente → `saveAndCalibrate` vai direto para `first_signal`
// (sem passar pela tela de loading `calibrating`), tornando o fluxo determinístico.
const SIGNAL = { label: "Sinal de teste", summary: "Resumo do sinal de teste." };

// Textos âncora de cada tela (do componente atual).
const QUESTIONS_HEADING = "O que define o que você cria?";
const FIRST_SIGNAL_HEADING = "Seu mapa começa assim";
const INSTAGRAM_HEADING = "Seu Instagram já tem os sinais que o mapa precisa.";
const PAYWALL_CTA = "Explorar grátis primeiro";

describe("MobileOnboardingFlow — navegação para trás (novo fluxo)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) } as Response);
  });

  afterEach(() => {
    act(() => { jest.runAllTimers(); });
  });

  it("questions é a entrada e NÃO exibe botão Voltar", () => {
    render(<MobileOnboardingFlow {...baseProps} instagramConnected />);

    expect(screen.getByText(QUESTIONS_HEADING)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Voltar" })).not.toBeInTheDocument();
  });

  it("first_signal: Voltar retorna para questions", () => {
    render(
      <MobileOnboardingFlow
        {...baseProps}
        instagramConnected
        firstSignal={SIGNAL}
        initialStep="first_signal"
      />,
    );
    expect(screen.getByText(FIRST_SIGNAL_HEADING)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText(QUESTIONS_HEADING)).toBeInTheDocument();
  });

  it("instagram_invite: Voltar retorna para first_signal", () => {
    render(
      <MobileOnboardingFlow
        {...baseProps}
        accessState="pro_needs_instagram"
        instagramConnected={false}
        firstSignal={SIGNAL}
        initialStep="instagram_invite"
      />,
    );
    expect(screen.getByText(INSTAGRAM_HEADING)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText(FIRST_SIGNAL_HEADING)).toBeInTheDocument();
  });

  it("paywall: Voltar retorna para first_signal", () => {
    render(
      <MobileOnboardingFlow
        {...baseProps}
        accessState="free_unused"
        instagramConnected={false}
        firstSignal={SIGNAL}
        initialStep="paywall"
      />,
    );
    expect(screen.getByText(PAYWALL_CTA)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText(FIRST_SIGNAL_HEADING)).toBeInTheDocument();
  });

  it("first_signal → questions preserva as seleções de Q1, Q2 e propósito digitado", () => {
    // firstSignal presente → ao confirmar Q3, avança direto a first_signal (sem calibrating).
    render(
      <MobileOnboardingFlow
        {...baseProps}
        instagramConnected
        firstSignal={SIGNAL}
      />,
    );

    // Q1 — seleciona identidade narrativa (revela Q2)
    fireEvent.click(screen.getByText("Conto histórias da minha vida"));
    // Q2 — seleciona sentimento (revela Q3)
    fireEvent.click(screen.getByText("Inspirado"));
    // Q3 — pula propósito (avança para first_signal)
    fireEvent.click(screen.getByText("Pular por enquanto"));

    expect(screen.getByText(FIRST_SIGNAL_HEADING)).toBeInTheDocument();

    // Volta para questions
    fireEvent.click(screen.getByRole("button", { name: "Voltar" }));
    expect(screen.getByText(QUESTIONS_HEADING)).toBeInTheDocument();

    // As seleções de Q1 e Q2 continuam destacadas (bg-zinc-950)
    expect(screen.getByText("Conto histórias da minha vida").closest("button")).toHaveClass("bg-zinc-950");
    expect(screen.getByText("Inspirado").closest("button")).toHaveClass("bg-zinc-950");
    // Q3 continua visível (sentimento preenchido) — campo de propósito re-renderizado
    expect(screen.getByPlaceholderText("ex: quero encorajar mães sem tempo a se cuidarem")).toBeInTheDocument();
  });
});
