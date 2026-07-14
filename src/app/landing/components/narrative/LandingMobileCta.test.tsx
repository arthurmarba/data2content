import { act, render, screen } from "@testing-library/react";

import { LandingMobileCta } from "./LandingMobileCta";

jest.mock("./LandingAuthCta", () => ({
  LandingAuthCta: ({ guestLabel }: { guestLabel: string }) => <a href="/entrar">{guestLabel}</a>,
}));

describe("LandingMobileCta", () => {
  it("some em seções visualmente sensíveis e retorna nas zonas calmas", () => {
    const callbacks: IntersectionObserverCallback[] = [];
    const observed: Element[] = [];

    class IntersectionObserverMock {
      constructor(callback: IntersectionObserverCallback) {
        callbacks.push(callback);
      }
      observe(element: Element) { observed.push(element); }
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = "0px";
      thresholds = [0.01];
    }

    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: IntersectionObserverMock });
    Object.defineProperty(global, "IntersectionObserver", { configurable: true, value: IntersectionObserverMock });
    document.cookie = "cookie_consent=essential; path=/";
    document.body.innerHTML = `
      <section class="d2c-human-hero"></section>
      <section data-landing-section="data-proof"></section>
      <section data-landing-section="collabs"></section>
      <section data-landing-section="connection-flow"></section>
      <section data-landing-section="weekly-community"></section>
      <section data-landing-section="whatsapp-community"></section>
      <section data-landing-section="authority"></section>
      <section data-landing-section="pricing"></section>
      <section class="d2c-human-final"></section>
    `;

    render(<LandingMobileCta />);

    expect(observed).toHaveLength(9);
    expect(screen.getByText("Criar com a minha cara")).toBeInTheDocument();

    const weeklySection = document.querySelector("[data-landing-section='weekly-community']")!;
    act(() => callbacks[0]!([{ target: weeklySection, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.queryByText("Criar com a minha cara")).not.toBeInTheDocument();

    act(() => callbacks[0]!([{ target: weeklySection, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText("Criar com a minha cara")).toBeInTheDocument();
  });
});
