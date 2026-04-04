import React from "react";
import { render } from "@testing-library/react";
import { shouldSidebarIntentPrefetch, useMobileAutoClose } from "./hooks";

const AutoCloseHarness = ({
  isMobile,
  isOpen,
  pathname,
  onToggle,
}: {
  isMobile: boolean;
  isOpen: boolean;
  pathname: string;
  onToggle: () => void;
}) => {
  useMobileAutoClose({ isMobile, isOpen, pathname, onToggle });
  return null;
};

describe("sidebar prefetch policy", () => {
  it("bloqueia prefetch da descoberta via sidebar", () => {
    expect(shouldSidebarIntentPrefetch("/planning/discover")).toBe(false);
    expect(shouldSidebarIntentPrefetch("/dashboard/discover")).toBe(false);
    expect(shouldSidebarIntentPrefetch("/planning/discover?format=reels")).toBe(false);
  });

  it("mantem prefetch para rotas leves do dashboard", () => {
    expect(shouldSidebarIntentPrefetch("/planning/roteiros")).toBe(true);
    expect(shouldSidebarIntentPrefetch("/planning/planner")).toBe(true);
    expect(shouldSidebarIntentPrefetch("/dashboard/chat")).toBe(true);
  });

  it("fecha o sidebar mobile apenas depois que a rota muda", () => {
    const onToggle = jest.fn();
    const { rerender } = render(
      <AutoCloseHarness
        isMobile={true}
        isOpen={true}
        pathname="/dashboard/home"
        onToggle={onToggle}
      />
    );

    expect(onToggle).not.toHaveBeenCalled();

    rerender(
      <AutoCloseHarness
        isMobile={true}
        isOpen={true}
        pathname="/dashboard/chat"
        onToggle={onToggle}
      />
    );

    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
