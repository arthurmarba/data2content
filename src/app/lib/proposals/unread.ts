export function buildUnreadCampaignsFilter(userId: unknown) {
  return {
    userId,
    $or: [
      { openedAt: { $exists: true, $eq: null } },
      { openedAt: { $exists: false }, status: "novo" },
    ],
  };
}

export function isUnreadCampaign(proposal: {
  openedAt?: Date | string | null;
  status?: string | null;
}) {
  if (proposal.openedAt) return false;
  return proposal.status === "novo";
}
