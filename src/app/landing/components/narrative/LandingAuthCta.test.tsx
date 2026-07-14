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

  it("starts Google with a CSRF-protected form submission for a visitor", () => {
    render(<LandingAuthCta className="cta" guestLabel="Entrar" />);
    fireEvent.click(screen.getByRole("button", { name: "Entrar" }));

    expect(submitGoogleSignInFallbackMock).toHaveBeenCalledWith("/dashboard");
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

  it("keeps authenticated navigation as a dashboard link", () => {
    useSessionMock.mockReturnValue({ data: { user: { id: "user-1" } } });

    render(<LandingAuthCta className="cta" guestLabel="Entrar" authenticatedLabel="Acessar" />);

    expect(screen.getByRole("link", { name: "Acessar" })).toHaveAttribute("href", "/dashboard");
  });
});
