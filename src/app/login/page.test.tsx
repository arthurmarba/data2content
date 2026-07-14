import { redirect } from "next/navigation";

import LoginPage, { buildLandingLoginRedirect } from "./page";

jest.mock("next/navigation", () => ({ redirect: jest.fn() }));

const redirectMock = redirect as jest.Mock;

describe("LoginPage", () => {
  beforeEach(() => redirectMock.mockClear());

  it("folds the login route into the public landing", () => {
    LoginPage({ searchParams: {} });
    expect(redirectMock).toHaveBeenCalledWith("/?auth=login");
  });

  it("preserves callback, intent and authentication error", () => {
    const target = buildLandingLoginRedirect({
      callbackUrl: "/dashboard/boards/mobile-strategic-profile",
      intent: "strategic_profile",
      error: "TermsConsentRequired",
    });

    expect(target).toBe(
      "/?auth=login&callbackUrl=%2Fdashboard%2Fboards%2Fmobile-strategic-profile&intent=strategic_profile&error=TermsConsentRequired",
    );
  });
});
