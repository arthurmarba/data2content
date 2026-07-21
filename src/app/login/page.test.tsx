import { render, screen, waitFor } from "@testing-library/react";
import { getServerSession } from "next-auth";
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
}));

jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }));

jest.mock("@/lib/auth/googleLogin", () => ({
  submitGoogleSignInFallback: jest.fn(),
}));

const submitGoogleSignInFallbackMock = submitGoogleSignInFallback as jest.Mock;
const getServerSessionMock = getServerSession as jest.Mock;
const redirectMock = redirect as unknown as jest.Mock;

describe("LoginPage", () => {
  beforeEach(() => {
    searchParamsGetMock.mockReset();
    submitGoogleSignInFallbackMock.mockReset().mockResolvedValue(undefined);
    getServerSessionMock.mockReset().mockResolvedValue(null);
    redirectMock.mockReset();
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
});
