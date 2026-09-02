import { act, render, screen } from "@testing-library/react";

import { LandingMobileCta } from "./LandingMobileCta";

jest.mock("./LandingAuthCta", () => ({
  LandingAuthCta: ({ guestLabel }: { guestLabel: string }) => <a href="/entrar">{guestLabel}</a>,
}));

jest.mock("lucide-react", () => ({
  ArrowRight: () => <svg aria-hidden="true" />,
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
    /* As seções do arco v6 que já trazem CTA próprio: herói, quem conduz,
       planos e fechamento. */
    document.body.innerHTML = `
      <section class="d2c-v6-hero"></section>
      <section data-landing-section="authority"></section>
      <section data-landing-section="pricing"></section>
      <section class="d2c-v6-close"></section>
    `;

    render(<LandingMobileCta />);

    expect(observed).toHaveLength(4);
    expect(screen.getByText("Criar conta grátis")).toBeInTheDocument();

    const pricingSection = document.querySelector("[data-landing-section='pricing']")!;
    act(() => callbacks[0]!([{ target: pricingSection, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.queryByText("Criar conta grátis")).not.toBeInTheDocument();

    act(() => callbacks[0]!([{ target: pricingSection, isIntersecting: false } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(screen.getByText("Criar conta grátis")).toBeInTheDocument();
  });
});
