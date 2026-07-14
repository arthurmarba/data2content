import { act, render } from "@testing-library/react";

import { track } from "@/lib/track";

import { LandingSectionTracker } from "./LandingSectionTracker";

jest.mock("@/lib/track", () => ({ track: jest.fn() }));

describe("LandingSectionTracker", () => {
  it("observa histórias longas com um limiar alcançável", () => {
    let callback: IntersectionObserverCallback | undefined;
    let options: IntersectionObserverInit | undefined;

    class IntersectionObserverMock {
      constructor(nextCallback: IntersectionObserverCallback, nextOptions?: IntersectionObserverInit) {
        callback = nextCallback;
        options = nextOptions;
      }
      observe() {}
      disconnect() {}
      unobserve() {}
      takeRecords() { return []; }
      root = null;
      rootMargin = "0px 0px -10% 0px";
      thresholds = [0.1];
    }

    Object.defineProperty(window, "IntersectionObserver", { configurable: true, value: IntersectionObserverMock });
    Object.defineProperty(global, "IntersectionObserver", { configurable: true, value: IntersectionObserverMock });
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: () => ({ matches: false, addEventListener: jest.fn(), removeEventListener: jest.fn() }),
    });
    document.body.innerHTML = '<section data-landing-section="weekly-community"></section>';

    const { unmount } = render(<LandingSectionTracker />);
    const section = document.querySelector("[data-landing-section='weekly-community']")!;

    expect(options).toEqual({ threshold: 0.1, rootMargin: "0px 0px -10% 0px" });
    act(() => callback!([{ target: section, isIntersecting: true } as IntersectionObserverEntry], {} as IntersectionObserver));
    expect(section).toHaveClass("is-in-view");
    expect(track).toHaveBeenCalledWith("landing_section_view", { section: "weekly-community" });

    unmount();
    expect(document.documentElement).not.toHaveClass("d2c-motion-ready");
  });
});
