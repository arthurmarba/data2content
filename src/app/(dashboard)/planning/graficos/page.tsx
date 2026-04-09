import NextDynamic from "next/dynamic";
import { getServerSession } from "next-auth";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { hasPlannerAccess } from "../utils";

export const dynamic = "force-dynamic";

const PlanningChartsPage = NextDynamic(
  () => import("@/app/dashboard/planning/PlanningChartsPage"),
  {
    ssr: false,
    loading: () => <PlanningChartsRouteSkeleton />,
  },
);

function PlanningChartsRouteSkeleton() {
  return (
    <div className="px-2 pb-6 pt-2 lg:px-0">
      <div className="overflow-hidden rounded-[1.8rem] border border-zinc-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,248,249,0.94))]">
        <div className="sticky top-0 z-10 border-b border-zinc-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,255,255,0.94))] px-3 py-3">
          <div className="h-10 w-full animate-pulse rounded-full bg-zinc-100" />
        </div>
        <div className="space-y-3 px-3 py-4 sm:px-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="h-28 animate-pulse rounded-[1.4rem] bg-zinc-100" />
            <div className="h-28 animate-pulse rounded-[1.4rem] bg-zinc-100" />
          </div>
          <div className="h-[320px] animate-pulse rounded-[1.6rem] bg-zinc-100" />
          <div className="grid gap-3">
            <div className="h-24 animate-pulse rounded-[1.35rem] bg-zinc-100" />
            <div className="h-24 animate-pulse rounded-[1.35rem] bg-zinc-100" />
          </div>
        </div>
      </div>
    </div>
  );
}

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
