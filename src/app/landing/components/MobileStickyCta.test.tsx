import React from "react";
import { act, render } from "@testing-library/react";

import MobileStickyCta from "./MobileStickyCta";

describe("MobileStickyCta", () => {
  it("stays hidden until the target section is reached", () => {
    const observe = jest.fn();
    let observerCallback: ((entries: Array<{ isIntersecting: boolean }>) => void) | null = null;

    class MockIntersectionObserver {
      constructor(callback: typeof observerCallback) {
        observerCallback = callback as typeof observerCallback;
      }

      observe = observe;

      disconnect = jest.fn();
    }

    Object.defineProperty(window, "IntersectionObserver", {
      writable: true,
      configurable: true,
      value: MockIntersectionObserver,
    });

    const target = document.createElement("div");
    target.id = "planos";
    document.body.appendChild(target);

    const { container } = render(
      <MobileStickyCta
        label="Quero entrar"
        onClick={jest.fn()}
        hideUntilScroll={false}
        showAfterTargetId="planos"
      />,
    );

    const wrapper = container.querySelector('[aria-hidden="true"]');
    expect(wrapper).not.toBeNull();
    expect(observe).toHaveBeenCalledWith(target);

    act(() => {
      observerCallback?.([{ isIntersecting: true }]);
    });

    const visibleWrapper = container.querySelector('[aria-hidden="false"]');
    expect(visibleWrapper).not.toBeNull();

    target.remove();
  });
});
