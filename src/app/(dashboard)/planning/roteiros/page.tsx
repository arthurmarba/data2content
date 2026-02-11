import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PlanningLockedView from "../PlanningLockedView";
import { hasPlannerAccess } from "../utils";
import MyScriptsPage from "@/app/dashboard/scripts/MyScriptsPage";

export const dynamic = "force-dynamic";

export default async function PlanningScriptsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!hasPlannerAccess(session.user)) {
    return <PlanningLockedView variant="planner" returnTo="/planning/roteiros" />;
  }

  return (
    <MyScriptsPage
      viewer={{
        id: session.user.id,
        role: session.user.role ?? null,
        name: session.user.name ?? null,
      }}
    />
  );
}
