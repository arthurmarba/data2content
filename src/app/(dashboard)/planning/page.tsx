import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";
import PlanningLockedView from "./PlanningLockedView";

export const dynamic = "force-dynamic";

export default async function PlanningIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  const user = session.user as any;
  const normalizedStatus = normalizePlanStatus(user?.planStatus);
  const role = typeof user?.role === "string" ? user.role.trim().toLowerCase() : null;
  const proTrialStatus = typeof user?.proTrialStatus === "string" ? user.proTrialStatus.trim().toLowerCase() : null;
  const hasProAccess =
    isPlanActiveLike(normalizedStatus) || proTrialStatus === "active" || role === "admin";

  if (!hasProAccess) {
    return <PlanningLockedView variant="planner" returnTo="/planning" />;
  }

  redirect("/planning/planner");
}
