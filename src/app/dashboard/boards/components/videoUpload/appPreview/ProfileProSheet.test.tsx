import { fireEvent, render, screen } from "@testing-library/react";

import { ProfileProSheet } from "./ProfileProSheet";

describe("convite contextual do Pro", () => {
  it("prende o foco no painel, fecha no Esc e restaura o foco ao desmontar", () => {
    const opener = document.createElement("button");
    document.body.appendChild(opener);
    opener.focus();
    const onClose = jest.fn();

    const { unmount } = render(
      <ProfileProSheet
        open
        onUpgrade={jest.fn()}
        onOpenNarrative={jest.fn()}
        onClose={onClose}
      />,
    );
    const panel = screen.getByRole("dialog").firstChild as HTMLElement;
    expect(document.activeElement).toBe(panel);
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true });
    expect(panel.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    expect(document.body.style.overflow).toBe("");
    expect(document.activeElement).toBe(opener);
    opener.remove();
  });

  it("não renderiza quando está fechado", () => {
    render(
      <ProfileProSheet
        open={false}
        onUpgrade={jest.fn()}
        onOpenNarrative={jest.fn()}
        onClose={jest.fn()}
      />,
    );
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
