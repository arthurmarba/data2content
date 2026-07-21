import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPlannerAccess } from "../utils";
import PlanningChartsPage from "./PlanningChartsClient";

export const dynamic = "force-dynamic";

export default async function PlanningChartsRoutePage() {
  const session = await getServerSession(authOptions);
  const user = session?.user as
    | {
        id?: string | null;
        role?: string | null;
        name?: string | null;
        affiliateCode?: string | null;
        instagramConnected?: boolean | null;
      }
    | undefined;

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
      <div className="mx-auto flex h-full min-h-0 w-full px-0 lg:px-8 lg:pb-5 lg:pt-[2.75rem]">
        <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden lg:w-[900px] xl:w-[940px]">
          <PlanningChartsPage
            viewer={{
              id: user?.id ?? "",
              role: user?.role ?? null,
              name: user?.name ?? null,
              affiliateCode:
                user?.affiliateCode ??
                (session as { affiliateCode?: string | null } | null)?.affiliateCode ??
                null,
            }}
            showPinButton
            pinButtonRedirectOnPin={false}
            compactView
            initialHasAccess={hasPlannerAccess(user)}
            initialInstagramConnected={Boolean(user?.instagramConnected)}
          />
        </div>
      </div>
    </main>
  );
}
