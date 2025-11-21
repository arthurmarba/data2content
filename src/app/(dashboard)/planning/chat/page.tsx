import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PlanningChatPage from "@/app/dashboard/planning/PlanningChatPage";
import PlanningLockedView from "../PlanningLockedView";
import { hasPlannerAccess } from "../utils";

export const dynamic = "force-dynamic";

export default async function PlanningChatRoutePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    redirect("/login");
  }

  if (!hasPlannerAccess(session.user)) {
    return <PlanningLockedView variant="planner" returnTo="/planning/chat" />;
  }

  return <PlanningChatPage />;
}
