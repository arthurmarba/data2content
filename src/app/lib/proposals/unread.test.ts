import {
  buildUnreadCampaignsFilter,
  isUnreadCampaign,
} from "./unread";

describe("campaign unread semantics", () => {
  it("conta documentos novos com openedAt nulo e legados com status novo", () => {
    expect(buildUnreadCampaignsFilter("user-1")).toEqual({
      userId: "user-1",
      $or: [
        { openedAt: { $exists: true, $eq: null } },
        { openedAt: { $exists: false }, status: "novo" },
      ],
    });
  });

  it("não considera proposta aberta ou já processada como não lida", () => {
    expect(isUnreadCampaign({ openedAt: new Date(), status: "novo" })).toBe(false);
    expect(isUnreadCampaign({ status: "respondido" })).toBe(false);
  });

  it("considera proposta nova sem openedAt como não lida", () => {
    expect(isUnreadCampaign({ openedAt: null, status: "novo" })).toBe(true);
    expect(isUnreadCampaign({ status: "novo" })).toBe(true);
  });
});
