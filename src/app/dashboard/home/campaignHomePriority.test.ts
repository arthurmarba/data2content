import { prioritizeCampaignBoardIds } from "./campaignHomePriority";

describe("prioritizeCampaignBoardIds", () => {
  const boardIds = ["strategic-map", "collabs", "campaigns", "discover"] as const;

  it("move Campanhas para o início quando há propostas novas", () => {
    expect(prioritizeCampaignBoardIds([...boardIds], true)).toEqual([
      "campaigns",
      "strategic-map",
      "collabs",
      "discover",
    ]);
  });

  it("preserva a ordem normal quando não há propostas novas", () => {
    expect(prioritizeCampaignBoardIds([...boardIds], false)).toEqual([...boardIds]);
  });
});
