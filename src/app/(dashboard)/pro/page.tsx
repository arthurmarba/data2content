import { getServerSession, type Session } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { normalizePlanStatus, isPlanActiveLike } from "@/utils/planStatus";
import ProPageClient from "@/app/pro/ProPageClient";

export const dynamic = "force-dynamic";

export default async function ProPage() {
  const session = await getServerSession(authOptions);
  type SessionUser = NonNullable<Session["user"]> & {
    id?: string;
    role?: string;
    planStatus?: unknown;
    proTrialStatus?: string;
  };
  const user = (session?.user ?? null) as SessionUser | null;

  const normalizedStatus = normalizePlanStatus(user?.planStatus);
  const role = typeof user?.role === "string" ? user.role.trim().toLowerCase() : null;
  const proTrialStatus =
    typeof user?.proTrialStatus === "string" ? user.proTrialStatus.trim().toLowerCase() : null;
  const hasProAccess =
    isPlanActiveLike(normalizedStatus) || proTrialStatus === "active" || role === "admin";

  return (
    <ProPageClient
      creatorId={user?.id ?? null}
      initialPlanStatus={{
        normalizedStatus,
        hasProAccess,
        isTrialActive: proTrialStatus === "active",
      }}
    />
  );
}
