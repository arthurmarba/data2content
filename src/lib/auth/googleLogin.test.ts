import {
  buildGoogleConsentLoginUrl,
  normalizeInternalCallbackUrl,
  submitGoogleSignInFallback,
} from "./googleLogin";

describe("normalizeInternalCallbackUrl", () => {
  it("keeps internal destinations and trims surrounding whitespace", () => {
    expect(normalizeInternalCallbackUrl(" /dashboard/boards/profile?tab=about ")).toBe(
      "/dashboard/boards/profile?tab=about",
    );
  });

  it.each(["", "https://example.com", "//example.com", "javascript:alert(1)"])(
    "replaces an unsafe callback URL (%s)",
    (callbackUrl) => {
      expect(normalizeInternalCallbackUrl(callbackUrl)).toBe("/dashboard");
      expect(buildGoogleConsentLoginUrl(callbackUrl)).toBe("/login?callbackUrl=%2Fdashboard");
    },
  );
});

describe("submitGoogleSignInFallback", () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    Object.defineProperty(global, "fetch", {
      configurable: true,
      value: fetchMock,
    });
  });

  it("submits a native Google sign-in form with the protected destination", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ csrfToken: "csrf-token" }),
    });
    const submitSpy = jest
      .spyOn(HTMLFormElement.prototype, "submit")
      .mockImplementation(() => undefined);

    await submitGoogleSignInFallback("/dashboard/boards/profile");

    const form = document.body.querySelector("form");
    expect(fetchMock).toHaveBeenCalledWith("/api/auth/csrf", {
      credentials: "same-origin",
      headers: { Accept: "application/json" },
    });
    expect(form).toHaveAttribute("method", "post");
    expect(form).toHaveAttribute("action", "/api/auth/signin/google");
    expect(form?.querySelector<HTMLInputElement>("[name='csrfToken']")?.value).toBe("csrf-token");
    expect(form?.querySelector<HTMLInputElement>("[name='callbackUrl']")?.value).toBe("/dashboard/boards/profile");
    expect(submitSpy).toHaveBeenCalledTimes(1);

    submitSpy.mockRestore();
  });

  it("does not submit without a valid CSRF response", async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503 });

    await expect(submitGoogleSignInFallback("/dashboard")).rejects.toThrow(
      "Unable to prepare Google sign-in (503)",
    );
  });
});
