import { act, render, screen } from "@testing-library/react";

import { FALLBACK_LANDING_CREATORS, MATCH_STORY } from "@/app/landing/narrativeData";

import { NarrativeMatch, MATCH_SCENE_DURATIONS } from "./NarrativeMatch";

let mockReducedMotion = false;

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({ alt, ...props }: { alt: string }) => {
    const imageProps = { ...props } as Record<string, unknown>;
    delete imageProps.fill;
    delete imageProps.priority;
    // eslint-disable-next-line @next/next/no-img-element
    return <img alt={alt} {...imageProps} />;
  },
}));

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

jest.mock("./LandingAuthCta", () => ({
  LandingAuthCta: ({ guestLabel }: { guestLabel: string }) => <a href="/entrar">{guestLabel}</a>,
}));

describe("NarrativeMatch", () => {
  const secondCreatorFirstName = FALLBACK_LANDING_CREATORS[1]!.name.split(" ")[0]!;

  beforeEach(() => {
    mockReducedMotion = false;
    jest.useFakeTimers();
  });
  afterEach(() => jest.useRealTimers());

  it("começa pela pauta real sem revelar o segundo creator", () => {
    render(<NarrativeMatch creators={FALLBACK_LANDING_CREATORS} />);

    expect(screen.getByRole("heading", { name: MATCH_STORY.ideaTitle })).toBeInTheDocument();
    expect(screen.getByText("Pauta para você")).toBeInTheDocument();
    expect(screen.queryByText(secondCreatorFirstName)).not.toBeInTheDocument();
  });

  it("avança automaticamente até revelar o match", () => {
    render(<NarrativeMatch creators={FALLBACK_LANDING_CREATORS} />);

    Object.values(MATCH_SCENE_DURATIONS).forEach((duration) => {
      act(() => jest.advanceTimersByTime(duration));
    });

    expect(screen.getByText("É um match")).toBeInTheDocument();
    expect(screen.getByText(secondCreatorFirstName)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ver novamente" })).toBeInTheDocument();
  });

  it("preserva a etapa de inclinação e swipe antes de mostrar o próximo card", () => {
    render(<NarrativeMatch creators={FALLBACK_LANDING_CREATORS} />);

    act(() => jest.advanceTimersByTime(MATCH_SCENE_DURATIONS.idea));
    expect(screen.getByText("Você escolheu — swipe para a direita")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(MATCH_SCENE_DURATIONS.ideaAccepted - 1));
    expect(screen.getByText("Você escolheu — swipe para a direita")).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByText("Uma possibilidade de collab")).toBeInTheDocument();
  });

  it("mostra diretamente o resultado para quem prefere movimento reduzido", () => {
    mockReducedMotion = true;
    render(<NarrativeMatch creators={FALLBACK_LANDING_CREATORS} />);

    expect(screen.getByText("É um match")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Ver novamente" })).not.toBeInTheDocument();
  });
});
