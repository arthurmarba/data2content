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
      <button type="button" onClick={() => pinBoard("collabs")}>
        pin-collabs
      </button>
      <button type="button" onClick={() => unpinBoard("collabs")}>
        unpin-collabs
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
      sanitizePinnedBoardIds(["media-kit", "discover", "campaigns", "profile-analysis", "invalid"]),
    ).toEqual([
      "strategic-map",
      "campaigns",
      "recorded-meetings",
      "media-kit",
      "affiliates",
    ]);
    expect(orderPinnedBoardIds(["discover", "collabs", "campaigns"])).toEqual([
      "collabs",
      "campaigns",
    ]);
  });

  it("mantém os boards fixos e descarta boards ocultos da lista sanitizada", () => {
    expect(sanitizePinnedBoardIds(["discover", "profile-analysis", "post-creation"])).toEqual(
      FIXED_PINNED_BOARD_IDS,
    );
  });

  it("usa os boards padrão quando não há preferência salva", async () => {
    render(<HookHarness />);

    await waitFor(() => {
      expect(screen.getByTestId("pins")).toHaveTextContent(DEFAULT_PINNED_BOARD_IDS.join(","));
    });
  });

  it("persiste pin e unpin por usuário", async () => {
    render(<HookHarness />);

    fireEvent.click(screen.getByRole("button", { name: "unpin-collabs" }));

    await waitFor(() => {
      expect(screen.getByTestId("pins")).toHaveTextContent(
        "strategic-map,campaigns,recorded-meetings,media-kit,affiliates",
      );
    });

    expect(window.localStorage.getItem("dashboard:pinned-boards:v1:user-1")).toBe(
      JSON.stringify(["strategic-map", "campaigns", "recorded-meetings", "media-kit", "affiliates"]),
    );

    fireEvent.click(screen.getByRole("button", { name: "pin-collabs" }));

    await waitFor(() => {
      expect(screen.getByTestId("pins")).toHaveTextContent(
        "strategic-map,collabs,campaigns,recorded-meetings,media-kit,affiliates",
      );
    });
  });
});
