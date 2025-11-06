import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import ProposalsClient from "@/app/dashboard/proposals/ProposalsClient";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  return <ProposalsClient />;
}
