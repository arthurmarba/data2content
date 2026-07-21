import { render, screen, waitFor } from "@testing-library/react";

import { submitGoogleSignInFallback } from "@/lib/auth/googleLogin";
import LoginPage from "./page";

const searchParamsGetMock = jest.fn();

jest.mock("next/navigation", () => ({
  useSearchParams: () => ({ get: searchParamsGetMock }),
}));

jest.mock("@/lib/auth/googleLogin", () => ({
  submitGoogleSignInFallback: jest.fn(),
}));

const submitGoogleSignInFallbackMock = submitGoogleSignInFallback as jest.Mock;

describe("LoginPage", () => {
  beforeEach(() => {
    searchParamsGetMock.mockReset();
    submitGoogleSignInFallbackMock.mockReset().mockResolvedValue(undefined);
  });

  it("starts Google authentication instead of redirecting back to the landing page", async () => {
    searchParamsGetMock.mockImplementation((key: string) =>
      key === "callbackUrl" ? "/dashboard" : null,
    );

    render(<LoginPage />);

    await waitFor(() => {
      expect(submitGoogleSignInFallbackMock).toHaveBeenCalledWith("/dashboard");
    });
    expect(screen.getByText("Abrindo login do Google...")).toBeInTheDocument();
  });

  it("offers a retry when Google authentication cannot be started", async () => {
    searchParamsGetMock.mockReturnValue(null);
    submitGoogleSignInFallbackMock.mockRejectedValue(new Error("network error"));

    render(<LoginPage />);

    expect(
      await screen.findByRole("button", { name: "Tentar novamente com Google" }),
    ).toBeInTheDocument();
  });
});
