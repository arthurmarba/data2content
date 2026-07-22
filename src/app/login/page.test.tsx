import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { getServerSession } from "next-auth";
import { signIn } from "next-auth/react";
import { redirect } from "next/navigation";

import { submitGoogleSignInFallback } from "@/lib/auth/googleLogin";
import LoginPage from "./page";

const searchParamsGetMock = jest.fn();

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

jest.mock("next-auth", () => ({
  __esModule: true,
  default: jest.fn(() => jest.fn()),
  getServerSession: jest.fn(),
  signIn: jest.fn(),
}));

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }));

jest.mock("@/lib/auth/googleLogin", () => ({
  normalizeInternalCallbackUrl: (value: string) => value,
  submitGoogleSignInFallback: jest.fn(),
}));

const submitGoogleSignInFallbackMock = submitGoogleSignInFallback as jest.Mock;
const getServerSessionMock = getServerSession as jest.Mock;
const redirectMock = redirect as unknown as jest.Mock;
const signInMock = signIn as jest.Mock;

describe("LoginPage", () => {
  beforeEach(() => {
    searchParamsGetMock.mockReset();
    submitGoogleSignInFallbackMock.mockReset().mockResolvedValue(undefined);
    getServerSessionMock.mockReset().mockResolvedValue(null);
    redirectMock.mockReset();
    signInMock.mockReset();
  });

  it("starts Google authentication instead of redirecting back to the landing page", async () => {
    searchParamsGetMock.mockImplementation((key: string) =>
      key === "callbackUrl" ? "/dashboard" : null,
    );

    render(await LoginPage());

    await waitFor(() => {
      expect(submitGoogleSignInFallbackMock).toHaveBeenCalledWith("/dashboard");
    });
    expect(screen.getByText("Abrindo login do Google...")).toBeInTheDocument();
  });

  it("offers a retry when Google authentication cannot be started", async () => {
    searchParamsGetMock.mockReturnValue(null);
    submitGoogleSignInFallbackMock.mockRejectedValue(new Error("network error"));

    render(await LoginPage());

    expect(
      await screen.findByRole("button", { name: "Tentar novamente com Google" }),
    ).toBeInTheDocument();
  });

  it("sends an existing session directly to the authenticated Home", async () => {
    getServerSessionMock.mockResolvedValue({ user: { id: "user-1" } });

    await LoginPage();

    expect(redirectMock).toHaveBeenCalledWith("/dashboard");
    expect(submitGoogleSignInFallbackMock).not.toHaveBeenCalled();
  });

  it("offers direct reviewer credentials without starting Google", async () => {
    searchParamsGetMock.mockImplementation((key: string) => {
      if (key === "review") return "1";
      if (key === "callbackUrl") return "/dashboard/instagram-connection";
      return null;
    });
    signInMock.mockResolvedValue({ ok: false, error: "CredentialsSignin" });

    render(await LoginPage());

    expect(screen.getByRole("heading", { name: "Acesso de revisão" })).toBeInTheDocument();
    expect(submitGoogleSignInFallbackMock).not.toHaveBeenCalled();

    fireEvent.change(screen.getByLabelText("E-mail"), {
      target: { value: "review@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Senha"), {
      target: { value: "test-password" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Entrar na conta de teste" }));

    await waitFor(() =>
      expect(signInMock).toHaveBeenCalledWith("credentials", {
        email: "review@example.com",
        password: "test-password",
        callbackUrl: "/dashboard/instagram-connection",
        redirect: false,
      }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "E-mail ou senha de revisão inválidos.",
    );
  });
});
