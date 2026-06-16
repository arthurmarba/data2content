import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import {
  DEFAULT_PINNED_BOARD_IDS,
  FIXED_PINNED_BOARD_IDS,
  orderPinnedBoardIds,
  sanitizePinnedBoardIds,
} from "./boardRegistry";
import { usePinnedBoards } from "./usePinnedBoards";

function HookHarness({ userId = "user-1" }: { userId?: string | null }) {
  const { pinnedBoardIds, pinBoard, unpinBoard } = usePinnedBoards(userId);

  return (
    <div>
      <output data-testid="pins">{pinnedBoardIds.join(",")}</output>
      <button type="button" onClick={() => pinBoard("post-creation")}>
        pin-post-creation
      </button>
      <button type="button" onClick={() => unpinBoard("discover")}>
        unpin-discover
      </button>
    </div>
  );
}

describe("usePinnedBoards", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("sanitiza ids inválidos e mantém a ordem do catálogo", () => {
    expect(
      sanitizePinnedBoardIds(["media-kit", "discover", "campaigns", "discover", "invalid"]),
    ).toEqual([
      "strategic-map",
      "campaigns",
      "discover",
      "media-kit",
    ]);
    expect(orderPinnedBoardIds(["discover", "campaigns"])).toEqual(["campaigns", "discover"]);
  });

  it("sempre mantém os boards fixos na lista sanitizada", () => {
    expect(sanitizePinnedBoardIds(["post-creation"])).toEqual([
      ...FIXED_PINNED_BOARD_IDS,
      "post-creation",
    ]);
  });

  it("usa os boards padrão quando não há preferência salva", async () => {
    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("pins")).toHaveTextContent(DEFAULT_PINNED_BOARD_IDS.join(","));
    });
  });

  it("persiste pin e unpin por usuário", async () => {
    render(<HookHarness />);

    fireEvent.click(screen.getByRole("button", { name: "pin-post-creation" }));

    await waitFor(() => {
      expect(screen.getByTestId("pins")).toHaveTextContent(
        "strategic-map,campaigns,discover,profile-analysis,media-kit,post-creation",
      );
    });

    expect(window.localStorage.getItem("dashboard:pinned-boards:v1:user-1")).toBe(
      JSON.stringify(["strategic-map", "campaigns", "discover", "profile-analysis", "media-kit", "post-creation"]),
    );

    fireEvent.click(screen.getByRole("button", { name: "unpin-discover" }));

    await waitFor(() => {
      expect(screen.getByTestId("pins")).toHaveTextContent("strategic-map,campaigns,discover,profile-analysis,media-kit");
    });
  });
});
