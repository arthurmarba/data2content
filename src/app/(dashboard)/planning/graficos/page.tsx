import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PlanningChartsPage from "@/app/dashboard/planning/PlanningChartsPage";

export const dynamic = "force-dynamic";

export default async function PlanningChartsRoutePage() {
  const session = await getServerSession(authOptions);

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden bg-transparent">
      <div className="mx-auto flex h-full min-h-0 w-full px-0 lg:px-8 lg:pb-5 lg:pt-[2.75rem]">
        <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden lg:w-[900px] xl:w-[940px]">
          <PlanningChartsPage
            viewer={{
              id: session?.user?.id ?? "",
              role: session?.user?.role ?? null,
              name: session?.user?.name ?? null,
              affiliateCode:
                (session?.user as { affiliateCode?: string | null } | undefined)?.affiliateCode ??
                (session as { affiliateCode?: string | null } | null)?.affiliateCode ??
                null,
            }}
            showPinButton
            pinButtonRedirectOnPin={false}
            compactView
          />
        </div>
      </div>
    </main>
  );
}
