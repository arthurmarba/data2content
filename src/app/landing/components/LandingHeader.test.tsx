import React from "react";
import { fireEvent, render, screen, within } from "@testing-library/react";

import LandingHeader from "./LandingHeader";

const mockUseSession = jest.fn();
const mockSignIn = jest.fn();
const mockTrack = jest.fn();

jest.mock("next-auth/react", () => ({
  useSession: () => mockUseSession(),
  signIn: (...args: unknown[]) => mockSignIn(...args),
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: ({
    fill,
    priority,
    ...props
  }: React.ImgHTMLAttributes<HTMLImageElement> & { fill?: boolean; priority?: boolean }) => (
    // eslint-disable-next-line @next/next/no-img-element
    <img {...props} alt={props.alt ?? ""} />
  ),
}));

jest.mock("@/lib/track", () => ({
  track: (...args: unknown[]) => mockTrack(...args),
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
  });

  it("shows login and signup actions in mobile menu for unauthenticated users", () => {
    mockUseSession.mockReturnValue({ data: null, status: "unauthenticated" });

    render(<LandingHeader showLoginButton />);

    fireEvent.click(screen.getByRole("button", { name: /menu/i }));

    const mobileMenu = document.getElementById("mobile-menu");
    expect(mobileMenu).not.toBeNull();
    const menu = within(mobileMenu as HTMLElement);

    expect(menu.getByRole("button", { name: /^login$/i })).toBeInTheDocument();
    expect(menu.getByRole("button", { name: /quero entrar na d2c/i })).toBeInTheDocument();
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

    expect(menu.getByRole("button", { name: /acessar consultoria/i })).toBeInTheDocument();
    expect(menu.queryByRole("button", { name: /login/i })).not.toBeInTheDocument();
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
    expect(menu.queryByRole("button", { name: /login/i })).not.toBeInTheDocument();
  });
});
