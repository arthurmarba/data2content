import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PlanningLockedView from "../PlanningLockedView";
import { hasPlannerAccess } from "../utils";
import DiscoverContentPage from "@/app/dashboard/discover/DiscoverContentPage";

export const dynamic = "force-dynamic";

export default async function PlanningDiscoverPage({
  searchParams,
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!hasPlannerAccess(session.user)) {
    return <PlanningLockedView />;
  }

  return <DiscoverContentPage searchParams={searchParams} />;
}
