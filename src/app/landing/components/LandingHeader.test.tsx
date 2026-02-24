import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

import LandingHeader from "./LandingHeader";

const mockUseSession = jest.fn();
const mockSignIn = jest.fn();
const mockTrack = jest.fn();
const mockAppendUtm = jest.fn((path: string) => path);

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

jest.mock("@/lib/track", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
}));

jest.mock("@/hooks/useUtmAttribution", () => ({
  useUtmAttribution: () => ({
    appendUtm: mockAppendUtm,
    utm: {},
  }),
}));

jest.mock("framer-motion", () => {
  const React = require("react");

  const MotionTag = (tag: string) => {
    const MockMotionComponent = React.forwardRef(
      ({ children, ...rest }: any, ref: React.Ref<any>) =>
        React.createElement(tag, { ...rest, ref }, children),
    );
    MockMotionComponent.displayName = `MockMotion(${tag})`;
    return MockMotionComponent;
  };

  const useMotionValue = (initial: number) => {
    let value = initial;
    return {
      get: () => value,
      set: (nextValue: number) => {
        value = nextValue;
      },
    };
  };

  const useMotionTemplate = (strings: TemplateStringsArray, ...values: unknown[]) =>
    String.raw({ raw: strings }, ...values);

  return {
    motion: new Proxy(
      {},
      {
        get: (_, prop) => MotionTag(String(prop)),
      },
    ),
    useScroll: () => ({ scrollY: 0 }),
    useTransform: () => 0,
    useMotionTemplate,
    useMotionValue,
    useSpring: (value: unknown) => value,
  };
});

describe("LandingHeader", () => {
  beforeEach(() => {
    mockSignIn.mockReset();
    mockTrack.mockReset();
    mockAppendUtm.mockClear();
  });

  it("shows login and signup actions in mobile menu for unauthenticated users", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    render(<LandingHeader showLoginButton />);

    fireEvent.click(screen.getByRole("button", { name: /menu/i }));

    const mobileMenu = document.getElementById("mobile-menu");
    expect(mobileMenu).not.toBeNull();
    const menu = within(mobileMenu as HTMLElement);

    expect(menu.getByRole("button", { name: /entrar/i })).toBeInTheDocument();
    expect(menu.getByRole("button", { name: /criar conta gratuita/i })).toBeInTheDocument();
  });

  it("shows dashboard access and hides login action for authenticated users", () => {
    mockUseSession.mockReturnValue({
      data: { user: { id: "user-1", email: "test@example.com" } },
      status: "authenticated",
    });

    render(<LandingHeader showLoginButton />);

    fireEvent.click(screen.getByRole("button", { name: /menu/i }));

    const mobileMenu = document.getElementById("mobile-menu");
    expect(mobileMenu).not.toBeNull();
    const menu = within(mobileMenu as HTMLElement);

    expect(menu.getByRole("button", { name: /ir para o painel/i })).toBeInTheDocument();
    expect(menu.queryByRole("button", { name: /entrar/i })).not.toBeInTheDocument();
  });

  it("hides brand CTA when hideBrandCta is enabled", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    render(<LandingHeader hideBrandCta />);

    fireEvent.click(screen.getByRole("button", { name: /menu/i }));

    const mobileMenu = document.getElementById("mobile-menu");
    expect(mobileMenu).not.toBeNull();
    const menu = within(mobileMenu as HTMLElement);

    expect(menu.queryByRole("button", { name: /sou marca/i })).not.toBeInTheDocument();
  });

  it("disables primary action while session is loading", () => {
    mockUseSession.mockReturnValue({ data: null, status: "loading" });

    render(<LandingHeader showLoginButton />);

    fireEvent.click(screen.getByRole("button", { name: /menu/i }));

    const mobileMenu = document.getElementById("mobile-menu");
    expect(mobileMenu).not.toBeNull();
    const menu = within(mobileMenu as HTMLElement);

    const loadingButton = menu.getByRole("button", { name: /carregando/i });
    expect(loadingButton).toBeDisabled();
    expect(menu.queryByRole("button", { name: /entrar/i })).not.toBeInTheDocument();
  });
});
