/**
 * saveAndCalibrate — error handling (novo fluxo).
 *
 * No novo fluxo, o avanço para a calibração acontece ao confirmar ou pular o
 * propósito (Q3) no step fundido `questions` — sem auto-advance. O criador
 * responde Q1 + Q2 e então vê Q3 (campo livre, opcional). "Continuar" ou
 * "Pular por enquanto" dispara saveAndCalibrate. Quando `firstSignal` NÃO é
 * fornecido, o fluxo passa pela tela de loading `calibrating` antes de `first_signal`.
 *
 * Garante que:
 *   1. API OK → avança para first_signal (heading seed "Aqui está o rascunho do seu mapa").
 *   2. Network error → exibe CalibratingScreen em modo de erro, não avança.
 *   3. API status 500 → mesmo comportamento de 2.
 *   4. Retry ("Tentar de novo") → tenta a API novamente.
 */
import React from "react";
import { render, screen, fireEvent, act, waitFor } from "@testing-library/react";
import { MobileOnboardingFlow } from "./MobileOnboardingFlow";

// framer-motion: renderiza children direto e sincroniza as trocas de step
// (AnimatePresence mode="wait" não completa a animação de saída em jsdom).
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

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

const defaultProps = {
  open: true,
  instagramConnected: true,
  accessState: "pro_instagram_connected" as const,
  onComplete: jest.fn(),
};

// Heading da tela first_signal quando o sinal é um seed (sem firstSignal fornecido).
const SEED_FIRST_SIGNAL_HEADING = "Aqui está o rascunho do seu mapa";

/**
 * Avança o onboarding até a tela de calibração:
 * seleciona identidade (Q1), sentimento (Q2) e pula o propósito (Q3).
 * Q3 substituiu o auto-advance de Q2 — o avanço agora exige ação explícita
 * ("Continuar" ou "Pular por enquanto").
 */
function advanceToCalibrating() {
  fireEvent.click(screen.getByText("Conto histórias da minha vida")); // Q1
  fireEvent.click(screen.getByText("Inspirado"));                     // Q2 → revela Q3
  fireEvent.click(screen.getByText("Pular por enquanto"));            // Q3 → chama saveAndCalibrate
}

describe("MobileOnboardingFlow — saveAndCalibrate error handling (novo fluxo)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    defaultProps.onComplete.mockClear();
  });

  afterEach(() => {
    act(() => { jest.runAllTimers(); });
  });

  it("API OK → avança para first_signal", async () => {
    mockFetch.mockResolvedValue({ ok: true } as Response);

    render(<MobileOnboardingFlow {...defaultProps} />);
    advanceToCalibrating();

    // Durante o delay mostra o loading de calibração
    expect(screen.getByText("Construindo seu mapa…")).toBeInTheDocument();
    expect(screen.queryByText(SEED_FIRST_SIGNAL_HEADING)).not.toBeInTheDocument();

    // Avança o delay (1200ms) + resolve o fetch
    await act(async () => { jest.runAllTimers(); });
    await waitFor(() =>
      expect(screen.getByText(SEED_FIRST_SIGNAL_HEADING)).toBeInTheDocument(),
    );
  });

  it("Fase 3 — API devolve seedSignal da IA → renderiza label/summary enriquecidos", async () => {
    const aiLabel = "Autocuidado como narrativa para mães em movimento";
    const aiSummary = "Você cria a partir do equilíbrio entre cuidar de si e dos outros.";
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ ok: true, seedSignal: { label: aiLabel, summary: aiSummary } }),
    } as Response);

    render(<MobileOnboardingFlow {...defaultProps} />);

    // Q1 + Q2 + Q3 com propósito digitado
    fireEvent.click(screen.getByText("Conto histórias da minha vida"));
    fireEvent.click(screen.getByText("Inspirado"));
    fireEvent.change(
      screen.getByPlaceholderText("ex: quero encorajar mães sem tempo a se cuidarem"),
      { target: { value: "quero encorajar mães sem tempo a se cuidarem" } },
    );
    fireEvent.click(screen.getByText("Continuar →"));

    await act(async () => { jest.runAllTimers(); });

    // O sinal enriquecido pela IA substitui o seed determinístico.
    await waitFor(() => expect(screen.getByText(aiLabel)).toBeInTheDocument());
    expect(screen.getByText(aiSummary)).toBeInTheDocument();
    // Continua sendo um seed → heading de rascunho.
    expect(screen.getByText(SEED_FIRST_SIGNAL_HEADING)).toBeInTheDocument();

    // O propósito foi enviado no corpo da requisição.
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.creatorPurpose).toBe("quero encorajar mães sem tempo a se cuidarem");
  });

  it("network error → mostra erro e NÃO avança para first_signal", async () => {
    mockFetch.mockRejectedValue(new Error("Network error"));

    render(<MobileOnboardingFlow {...defaultProps} />);
    advanceToCalibrating();

    await act(async () => { jest.runAllTimers(); });

    await waitFor(() =>
      expect(screen.getByText("Não conseguimos conectar agora. Tente de novo.")).toBeInTheDocument(),
    );
    expect(screen.queryByText(SEED_FIRST_SIGNAL_HEADING)).not.toBeInTheDocument();
  });

  it("API status 500 → mostra erro e NÃO avança", async () => {
    mockFetch.mockResolvedValue({ ok: false, status: 500 } as Response);

    render(<MobileOnboardingFlow {...defaultProps} />);
    advanceToCalibrating();

    await act(async () => { jest.runAllTimers(); });

    await waitFor(() =>
      expect(screen.getByText("Não conseguimos conectar agora. Tente de novo.")).toBeInTheDocument(),
    );
    expect(screen.queryByText(SEED_FIRST_SIGNAL_HEADING)).not.toBeInTheDocument();
  });

  it("retry após erro → tenta API novamente", async () => {
    mockFetch
      .mockRejectedValueOnce(new Error("Network error"))
      .mockResolvedValueOnce({ ok: true } as Response);

    render(<MobileOnboardingFlow {...defaultProps} />);
    advanceToCalibrating();

    await act(async () => { jest.runAllTimers(); });
    await waitFor(() =>
      expect(screen.getByText("Tentar de novo")).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByText("Tentar de novo"));
    await act(async () => { jest.runAllTimers(); });

    await waitFor(() =>
      expect(screen.getByText(SEED_FIRST_SIGNAL_HEADING)).toBeInTheDocument(),
    );
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
