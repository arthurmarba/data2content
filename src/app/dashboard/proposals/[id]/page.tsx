import { redirect } from "next/navigation";
import { buildCampaignProposalHref } from "@/constants/routes";

export const dynamic = "force-dynamic";

type LegacyProposalDetailPageProps = {
  params: Promise<{ id: string }> | { id: string };
};

export default async function LegacyProposalDetailPage({
  params,
}: LegacyProposalDetailPageProps) {
  const { id } = await params;
  redirect(buildCampaignProposalHref(id));
}
