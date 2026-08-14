import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PlanningLockedView from "../PlanningLockedView";
import { hasPlannerAccess } from "../utils";
import { COMMUNITY_PRO_JOIN_ROUTE } from "@/app/lib/communityLinks";

export const dynamic = "force-dynamic";

export default async function PlanningWhatsAppPage() {
  const session = await getServerSession(authOptions);

  if (!hasPlannerAccess(session?.user)) {
    return <PlanningLockedView variant="whatsapp" returnTo="/planning/whatsapp" />;
  }

  // A rota autenticada resolve o convite sem enviá-lo ao bundle do navegador.
  redirect(COMMUNITY_PRO_JOIN_ROUTE);
}
