import { fireEvent, render, screen } from "@testing-library/react";
import CookieConsent from "./CookieConsent";

jest.mock("next/navigation", () => ({
  usePathname: () => "/",
}));

function expireCookie(name: string) {
  document.cookie = `${name}=; Max-Age=0; Path=/`;
}

function readCookie(name: string): string | null {
  const row = document.cookie
    .split("; ")
    .find((cookie) => cookie.startsWith(`${name}=`));
  return row?.slice(name.length + 1) ?? null;
}

describe("CookieConsent OpenAI attribution", () => {
  beforeEach(() => {
    expireCookie("cookie_consent");
    expireCookie("__oppref");
    expireCookie("__obref");
    window.history.replaceState(null, "", "/?oppref=oai_AbC-123.x_y");
    (window as any).oaiq = jest.fn();
  });

  afterEach(() => {
    expireCookie("cookie_consent");
    expireCookie("__oppref");
    expireCookie("__obref");
    delete (window as any).oaiq;
  });

  it("stores the landing oppref only after consent is granted", async () => {
    render(<CookieConsent />);

    fireEvent.click(await screen.findByRole("button", { name: "Aceitar" }));

    expect(readCookie("cookie_consent")).toBe("granted");
    expect(readCookie("__oppref")).toBe("oai_AbC-123.x_y");
    expect((window as any).oaiq).toHaveBeenCalledWith("consent", true);
  });

  it("removes OpenAI attribution cookies when consent is declined", async () => {
    document.cookie = "__oppref=old-click; Path=/";
    document.cookie = "__obref=old-browser; Path=/";
    render(<CookieConsent />);

    fireEvent.click(await screen.findByRole("button", { name: "Só essenciais" }));

    expect(readCookie("cookie_consent")).toBe("denied");
    expect(readCookie("__oppref")).toBeNull();
    expect(readCookie("__obref")).toBeNull();
    expect((window as any).oaiq).toHaveBeenCalledWith("consent", false);
  });
});
