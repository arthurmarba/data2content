import React from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { SidebarSectionList, type SidebarInteractionState, type SidebarPresentationTokens } from "./components";
import type { SidebarIconSet, SidebarSection } from "./types";
import { useBodyScrollLock } from "./hooks";

const Icon = (props: React.SVGProps<SVGSVGElement>) => <svg aria-hidden="true" {...props} />;

const iconSet: SidebarIconSet = {
  outline: Icon,
  solid: Icon,
};

const baseTokens: SidebarPresentationTokens = {
  showLabels: true,
  alignClass: "justify-start",
  itemPadding: "px-3 py-2",
  itemGap: "gap-3",
  itemTextSize: "text-sm",
  iconSize: "h-5 w-5",
  collapsedIconShift: "",
  focusOffsetClass: "focus-visible:ring-offset-white",
};

const baseInteraction: SidebarInteractionState = {
  isMobile: true,
  isOpen: true,
  openPaywall: jest.fn(),
  navigateTo: jest.fn(),
};

const sections: SidebarSection[] = [
  {
    key: "core",
    title: "Core",
    items: [
      {
        type: "item",
        key: "home",
        label: "Painel",
        href: "/dashboard/home",
        icon: iconSet,
      },
      {
        type: "item",
        key: "chat",
        label: "Chat",
        href: "/dashboard/chat",
        icon: iconSet,
      },
    ],
  },
];

const LockHarness = ({ enabled }: { enabled: boolean }) => {
  useBodyScrollLock(enabled);
  return null;
};

describe("sidebar mobile behavior", () => {
  it("usa lista mobile sem deslocamento que pode cortar o primeiro item", () => {
    const { container } = render(
      <SidebarSectionList
        sections={sections}
        tokens={baseTokens}
        pathname="/dashboard/home"
        userId={null}
        interaction={baseInteraction}
      />
    );

    expect(screen.getByRole("link", { name: "Painel" })).toBeInTheDocument();
    const list = container.querySelector("ul");
    expect(list).toHaveClass("flex", "flex-col", "gap-1.5", "pb-3", "pt-1");
    expect(list?.className).not.toContain("-translate-y-12");
    expect(list?.className).not.toContain("justify-center");
  });

  it("mantém layout desktop centralizado", () => {
    const { container } = render(
      <SidebarSectionList
        sections={sections}
        tokens={baseTokens}
        pathname="/dashboard/home"
        userId={null}
        interaction={{ ...baseInteraction, isMobile: false, isOpen: false }}
      />
    );

    const list = container.querySelector("ul");
    expect(list).toHaveClass("flex", "flex-1", "flex-col", "justify-start", "gap-2", "pb-3", "pt-2");
    expect(list?.className).not.toContain("-translate-y-12");
  });

  it("bloqueia scroll por overflow sem desabilitar touchAction", () => {
    const { rerender, unmount } = render(<LockHarness enabled={true} />);
    expect(document.body.style.overflow).toBe("hidden");
    expect(document.body.style.touchAction).not.toBe("none");

    rerender(<LockHarness enabled={false} />);
    expect(document.body.style.overflow).toBe("");
    expect(document.body.style.touchAction).not.toBe("none");

    unmount();
    expect(document.body.style.overflow).toBe("");
  });

  it("navega programaticamente ao clicar em um link do sidebar", () => {
    const interaction = { ...baseInteraction, navigateTo: jest.fn() };

    render(
      <SidebarSectionList
        sections={sections}
        tokens={baseTokens}
        pathname="/dashboard/home"
        userId={null}
        interaction={interaction}
      />
    );

    fireEvent.click(screen.getByRole("link", { name: "Chat" }));
    expect(interaction.navigateTo).toHaveBeenCalledWith("/dashboard/chat");
  });

  it("preserva comportamento nativo com modificadores", () => {
    const interaction = { ...baseInteraction, navigateTo: jest.fn() };

    render(
      <SidebarSectionList
        sections={sections}
        tokens={baseTokens}
        pathname="/dashboard/home"
        userId={null}
        interaction={interaction}
      />
    );

    fireEvent.click(screen.getByRole("link", { name: "Chat" }), { ctrlKey: true });
    expect(interaction.navigateTo).not.toHaveBeenCalled();
  });
});
