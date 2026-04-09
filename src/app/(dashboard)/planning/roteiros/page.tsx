import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PostCreationScriptsBoard from "@/app/dashboard/boards/PostCreationScriptsBoard";
import { hasPlannerAccess } from "../utils";

export const dynamic = "force-dynamic";

export default async function PlanningScriptsPage({
}: {
  searchParams?: { tab?: string };
}) {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/planning/roteiros")}`);
  }

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full px-0 lg:px-8 lg:pb-5 lg:pt-[2.75rem]">
        <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden lg:w-[900px] xl:w-[940px]">
          <PostCreationScriptsBoard
            viewer={{
              id: session.user.id ?? "",
              role: session.user.role ?? null,
              name: session.user.name ?? null,
            }}
            canInteract={hasPlannerAccess(session.user)}
            initialInstagramConnected={Boolean((session.user as { instagramConnected?: boolean | null }).instagramConnected)}
          />
        </div>
      </div>
    </main>
  );
}
