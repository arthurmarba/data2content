import { act, fireEvent, render, screen } from "@testing-library/react";

import { CALCULATOR_STAGE_DURATIONS, NarrativeCalculator } from "./NarrativeCalculator";

let mockReducedMotion = false;

jest.mock("lucide-react", () => {
  const Icon = () => <svg aria-hidden="true" />;
  return {
    ArrowLeft: Icon,
    ArrowRight: Icon,
    BriefcaseBusiness: Icon,
    Check: Icon,
    LoaderCircle: Icon,
    Minus: Icon,
    Plus: Icon,
    RotateCcw: Icon,
    X: Icon,
  };
});

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
    useInView: () => true,
    useReducedMotion: () => mockReducedMotion,
  };
});

describe("NarrativeCalculator", () => {
  beforeEach(() => {
    mockReducedMotion = false;
    jest.useFakeTimers();
  });

  afterEach(() => jest.useRealTimers());

  it("começa pela etapa de entrega do app mobile", () => {
    render(<NarrativeCalculator />);

    expect(screen.getByText("Etapa 1 de 5")).toBeInTheDocument();
    expect(screen.getByText("Entrega")).toBeInTheDocument();
    expect(screen.getByText("185 mil pessoas")).toBeInTheDocument();
    expect(screen.getByText("Stories").parentElement).toHaveTextContent("3");
    expect(screen.queryByText("R$ 2.800")).not.toBeInTheDocument();
  });

  it("percorre proteção, contexto e histórico antes do cálculo", () => {
    render(<NarrativeCalculator />);

    act(() => jest.advanceTimersByTime(CALCULATOR_STAGE_DURATIONS[0]));
    expect(screen.getByText("Uso e proteção")).toBeInTheDocument();
    expect(screen.getByText("Mídia paga")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(CALCULATOR_STAGE_DURATIONS[1]));
    expect(screen.getByText("Contexto da parceria")).toBeInTheDocument();
    expect(screen.getByText("Collab no Instagram")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(CALCULATOR_STAGE_DURATIONS[2]));
    expect(screen.getByText("Seu histórico de preço")).toBeInTheDocument();
    expect(screen.getByText("R$ 1.500 por 1 Reel orgânico")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(CALCULATOR_STAGE_DURATIONS[3]));
    expect(screen.getAllByText("Calculando sua faixa")).toHaveLength(2);
    expect(screen.queryByText("R$ 2.800")).not.toBeInTheDocument();
  });

  it("revela mínimo, justo e máximo antes de salvar no Media Kit", () => {
    render(<NarrativeCalculator />);

    CALCULATOR_STAGE_DURATIONS.slice(0, 5).forEach((duration) => {
      act(() => jest.advanceTimersByTime(duration));
    });

    expect(screen.getByText("Mínimo")).toBeInTheDocument();
    expect(screen.getByText("Justo")).toBeInTheDocument();
    expect(screen.getByText("Máximo")).toBeInTheDocument();
    expect(screen.getByText("R$ 2.800")).toBeInTheDocument();
    expect(screen.queryByText("Pacote salvo no Media Kit")).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(CALCULATOR_STAGE_DURATIONS[5]));

    expect(screen.getByText("Pacote salvo no Media Kit")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver novamente/i })).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText("Pacote salvo no Media Kit")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /ver novamente/i }));
    expect(screen.getByText("Entrega")).toBeInTheDocument();
    expect(screen.queryByText("Pacote salvo no Media Kit")).not.toBeInTheDocument();
  });

  it("mostra diretamente o resultado final com movimento reduzido", () => {
    mockReducedMotion = true;
    render(<NarrativeCalculator />);

    expect(screen.getByText("Etapa 5 de 5")).toBeInTheDocument();
    expect(screen.getByText("Justo")).toBeInTheDocument();
    expect(screen.getByText("Pacote salvo no Media Kit")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver novamente/i })).not.toBeInTheDocument();
  });
});
