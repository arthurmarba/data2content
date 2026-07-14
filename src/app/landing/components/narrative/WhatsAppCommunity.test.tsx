import { act, fireEvent, render, screen } from "@testing-library/react";

import { FALLBACK_LANDING_CREATORS } from "@/app/landing/narrativeData";

import { CHAT_FRAME_DURATIONS, WhatsAppCommunity } from "./WhatsAppCommunity";

let mockReducedMotion = false;

jest.mock("framer-motion", () => {
  const React = require("react");
  const Motion = React.forwardRef(
    ({ children, initial, animate, exit, transition, ...props }: any, ref: any) =>
      React.createElement("li", { ...props, ref }, children),
  );
  Motion.displayName = "MotionMock";

  return {
    AnimatePresence: ({ children }: any) => children,
    motion: new Proxy({}, { get: () => Motion }),
    useInView: () => true,
    useReducedMotion: () => mockReducedMotion,
  };
});

jest.mock("./CreatorAvatar", () => ({
  CreatorAvatar: ({ creator }: { creator: { name: string } }) => (
    <span aria-label={`Avatar de ${creator.name}`} />
  ),
}));

describe("WhatsAppCommunity", () => {
  const renderConversation = () => render(
    <WhatsAppCommunity
      creators={FALLBACK_LANDING_CREATORS}
      communityCreators={FALLBACK_LANDING_CREATORS}
    />,
  );

  beforeEach(() => {
    mockReducedMotion = false;
    jest.useFakeTimers();
    Object.defineProperty(HTMLElement.prototype, "scrollTo", {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => jest.useRealTimers());

  it("começa pelo match e dá tempo para a pessoa ler antes da primeira mensagem", () => {
    renderConversation();

    expect(screen.getByText("Match por pauta")).toBeInTheDocument();
    expect(screen.queryByText(/seguir uma fórmula estava apagando/i)).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(CHAT_FRAME_DURATIONS[0] - 1));
    expect(screen.queryByText(/seguir uma fórmula estava apagando/i)).not.toBeInTheDocument();

    act(() => jest.advanceTimersByTime(1));
    expect(screen.getByText(/seguir uma fórmula estava apagando/i)).toBeInTheDocument();
  });

  it("mantém a conversa em ordem e termina sem reiniciar automaticamente", () => {
    renderConversation();

    CHAT_FRAME_DURATIONS.forEach((duration) => {
      act(() => jest.advanceTimersByTime(duration));
    });

    expect(screen.getByText(/também vivi isso/i)).toBeInTheDocument();
    expect(screen.getByText(/essa pauta pode ajudar no roteiro/i)).toBeInTheDocument();
    expect(screen.getByText(/gravamos semana que vem/i)).toBeInTheDocument();
    expect(screen.getByText("Collab combinada")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /ver conversa novamente/i })).toBeInTheDocument();

    act(() => jest.advanceTimersByTime(30_000));
    expect(screen.getByText("Collab combinada")).toBeInTheDocument();
  });

  it("permite rever a história desde o match", () => {
    renderConversation();
    CHAT_FRAME_DURATIONS.forEach((duration) => {
      act(() => jest.advanceTimersByTime(duration));
    });

    fireEvent.click(screen.getByRole("button", { name: /ver conversa novamente/i }));

    expect(screen.getByText("Match por pauta")).toBeInTheDocument();
    expect(screen.queryByText(/seguir uma fórmula estava apagando/i)).not.toBeInTheDocument();
    expect(screen.queryByText("Collab combinada")).not.toBeInTheDocument();
  });

  it("mostra a conversa completa sem animação para movimento reduzido", () => {
    mockReducedMotion = true;
    renderConversation();

    expect(screen.getByText(/seguir uma fórmula estava apagando/i)).toBeInTheDocument();
    expect(screen.getByText(/também vivi isso/i)).toBeInTheDocument();
    expect(screen.getByText("Collab combinada")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /ver conversa novamente/i })).not.toBeInTheDocument();
  });
});
