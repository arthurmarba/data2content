import { fireEvent, render, screen } from "@testing-library/react";
import { useSession } from "next-auth/react";
import { useSearchParams } from "next/navigation";

import { LandingAuthCta } from "./LandingAuthCta";

jest.mock("next-auth/react", () => ({ useSession: jest.fn() }));
jest.mock("next/navigation", () => ({ useSearchParams: jest.fn() }));
jest.mock("@/lib/track", () => ({ track: jest.fn() }));
jest.mock("@/lib/auth/googleLogin", () => ({ submitGoogleSignInFallback: jest.fn() }));

import { submitGoogleSignInFallback } from "@/lib/auth/googleLogin";

const useSessionMock = useSession as jest.Mock;
const useSearchParamsMock = useSearchParams as jest.Mock;
const submitGoogleSignInFallbackMock = submitGoogleSignInFallback as jest.Mock;

describe("LandingAuthCta", () => {
  beforeEach(() => {
    useSessionMock.mockReturnValue({ data: null });
    useSearchParamsMock.mockReturnValue(new URLSearchParams());
    submitGoogleSignInFallbackMock.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it("manda quem cria conta para o onboarding, não direto para a reunião", () => {
    render(<LandingAuthCta className="cta" guestLabel="Entrar" destination="/reuniao" />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(submitGoogleSignInFallbackMock).toHaveBeenCalledWith(
      "/dashboard/boards/mobile-strategic-profile",
    );
  });

  it("preserves the protected destination received from /login", () => {
    useSearchParamsMock.mockReturnValue(new URLSearchParams({
      callbackUrl: "/dashboard/boards/mobile-strategic-profile",
    }));

    render(<LandingAuthCta className="cta" guestLabel="Continuar" />);
    fireEvent.click(screen.getByRole("button", { name: "Continuar" }));

    expect(submitGoogleSignInFallbackMock).toHaveBeenCalledWith(
      "/dashboard/boards/mobile-strategic-profile",
    );
  });

  it("leva quem já tem conta ao Perfil, onde fica o card da reunião", () => {
    useSessionMock.mockReturnValue({ data: { user: { id: "user-1" } } });

    render(<LandingAuthCta className="cta" guestLabel="Entrar" authenticatedLabel="Acessar" />);

    expect(screen.getByRole("link", { name: "Acessar" })).toHaveAttribute(
      "href",
      "/dashboard/boards/mobile-strategic-profile",
    );
  });

  it("permite sobrescrever o destino de quem cria conta", () => {
    render(
      <LandingAuthCta
        className="cta"
        guestLabel="Assistir"
        destination="/reuniao"
        guestDestination="/reuniao"
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Assistir" }));
    expect(submitGoogleSignInFallbackMock).toHaveBeenCalledWith("/reuniao");
  });

  it("mantém a reunião como destino de quem já tem conta", () => {
    useSessionMock.mockReturnValue({ data: { user: { id: "user-1" } } });
    const { rerender } = render(
      <LandingAuthCta className="cta" guestLabel="Assistir" authenticatedLabel="Abrir" destination="/reuniao" />,
    );
    rerender(
      <LandingAuthCta className="cta" guestLabel="Assistir" authenticatedLabel="Abrir" destination="/reuniao" />,
    );
    expect(screen.getByRole("link", { name: "Abrir" })).toHaveAttribute("href", "/reuniao");
  });
});
