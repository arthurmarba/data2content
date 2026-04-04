import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import PostCreationPinnedBoard from "@/app/dashboard/boards/PostCreationPinnedBoard";

export const dynamic = "force-dynamic";

export default async function PlanningScriptsPage() {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/planning/roteiros")}`);
  }

  return (
    <main className="flex h-full min-h-0 w-full flex-col overflow-hidden">
      <div className="mx-auto flex h-full min-h-0 w-full px-0 lg:px-8 lg:pb-5 lg:pt-[2.75rem]">
        <div className="mx-auto flex h-full min-h-0 w-full flex-col overflow-hidden lg:w-[900px] xl:w-[940px]">
          <PostCreationPinnedBoard />
        </div>
      </div>
    </main>
  );
}
