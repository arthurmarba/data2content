import { render, screen } from "@testing-library/react";
import LoginClient from "./LoginClient";

let currentSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => currentSearchParams,
}));

jest.mock("next-auth/react", () => ({
  signIn: jest.fn(),
}));

describe("LoginClient", () => {
  beforeEach(() => {
    currentSearchParams = new URLSearchParams();
  });

  it("renders default copy without callbackUrl", () => {
    render(<LoginClient />);

    expect(screen.getByText("Continue na plataforma")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar com Google/ })).toBeInTheDocument();
  });

  it("renders strategic profile copy from callbackUrl", () => {
    currentSearchParams = new URLSearchParams({
      callbackUrl: "/dashboard/boards/mobile-strategic-profile-preview",
    });

    render(<LoginClient />);

    expect(screen.getByText("Perfil Estratégico")).toBeInTheDocument();
    expect(screen.getByText("Crie seu Perfil Estratégico")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar e criar perfil/ })).toBeInTheDocument();
  });

  it("renders analyze video copy from callbackUrl intent", () => {
    currentSearchParams = new URLSearchParams({
      callbackUrl: "/profile?intent=analyze_video",
    });

    render(<LoginClient />);

    expect(screen.getByText("Análise narrativa")).toBeInTheDocument();
    expect(screen.getByText("Entre para analisar seu primeiro vídeo")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Entrar e analisar vídeo/ })).toBeInTheDocument();
  });
});
