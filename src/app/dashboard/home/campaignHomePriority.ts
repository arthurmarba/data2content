import type { PinnableBoardId } from "../boards/boardRegistry";

export function prioritizeCampaignBoardIds(
  boardIds: PinnableBoardId[],
  hasUnreadCampaigns: boolean,
): PinnableBoardId[] {
  if (!hasUnreadCampaigns || !boardIds.includes("campaigns")) {
    return boardIds;
  }

  return ["campaigns", ...boardIds.filter((boardId) => boardId !== "campaigns")];
}
