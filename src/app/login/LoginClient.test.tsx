import { fireEvent, render, screen } from "@testing-library/react";
import { signIn } from "next-auth/react";
import LoginClient from "./LoginClient";
let currentSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

const signInMock = signIn as jest.Mock;

describe("LoginClient", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
    signInMock.mockClear();
    signInMock.mockResolvedValue(undefined);
    (window as any).gtag = jest.fn();
  });

  it("renders default copy without callbackUrl", () => {
    render(<LoginClient />);

    expect(screen.getByText("Seu mapa está esperando")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/ })).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("renders strategic profile copy from callbackUrl", () => {
    currentSearchParams = new URLSearchParams({
      callbackUrl: "/dashboard/boards/mobile-strategic-profile",
    });

    render(<LoginClient />);

    expect(screen.getByText("Seu mapa começa aqui")).toBeInTheDocument();
    expect(screen.getByText("Entenda o que seu conteúdo diz sobre você")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/ })).toBeInTheDocument();
  });

  it("renders strategic profile copy from login intent", () => {
    currentSearchParams = new URLSearchParams({
      callbackUrl: "/dashboard/boards/mobile-strategic-profile",
      intent: "strategic_profile",
    });

    render(<LoginClient />);

    expect(screen.getByText("Seu mapa começa aqui")).toBeInTheDocument();
    expect(screen.getByText("Entenda o que seu conteúdo diz sobre você")).toBeInTheDocument();
    expect(screen.queryByText(/crédito gratuito/i)).not.toBeInTheDocument();
  });

  it("renders analyze video copy from callbackUrl intent", () => {
    currentSearchParams = new URLSearchParams({
      callbackUrl: "/profile?intent=analyze_video",
    });

    render(<LoginClient />);

    expect(screen.getByText("Análise do seu conteúdo")).toBeInTheDocument();
    expect(screen.getByText("Continue sua análise")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/ })).toBeInTheDocument();
  });

  it("shows legal acceptance copy without a checkbox", () => {
    render(<LoginClient />);

    expect(screen.getByText(/Ao continuar, você aceita os/)).toBeInTheDocument();
    expect(screen.getByText("Termos")).toBeInTheDocument();
    expect(screen.getByText("Política de Privacidade")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("calls signIn with Google when continuing", () => {
    currentSearchParams = new URLSearchParams({
      callbackUrl: "/dashboard/boards/mobile-strategic-profile",
    });

    render(<LoginClient />);
    fireEvent.click(screen.getByRole("button", { name: /Continuar com Google/ }));

    expect(signInMock).toHaveBeenCalledWith("google", {
      callbackUrl: "/dashboard/boards/mobile-strategic-profile",
    });
  });
});
