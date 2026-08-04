import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { Film } from "lucide-react";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import RecordedMeetingsLibrary from "@/app/dashboard/recorded-meetings/RecordedMeetingsLibrary";
import { canAccessRecordedMeetings } from "@/app/lib/community/recordedMeetingsAccess";
import {
  getRecordedMeetings,
  type RecordedMeeting,
} from "@/app/lib/community/recordedMeetingsService";
import { RECORDED_MEETINGS_ROUTE } from "@/constants/routes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reuniões gravadas | Data2Content",
  description: "Biblioteca das reuniões gravadas para assinantes Data2Content.",
};

export default async function RecordedMeetingsPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(RECORDED_MEETINGS_ROUTE)}`);
  }

  const viewer = session.user as { id?: string | null; role?: string | null };
  if (!(await canAccessRecordedMeetings(viewer))) {
    redirect(`/pro?source=recorded_meetings&returnTo=${encodeURIComponent(RECORDED_MEETINGS_ROUTE)}`);
  }

  let meetings: RecordedMeeting[] = [];
  try {
    meetings = await getRecordedMeetings();
  } catch (error) {
    console.error("[recorded-meetings-page] Falha ao carregar playlist:", error);
  }

  return (
    <div className="h-full min-h-0 overflow-y-auto bg-[#f7f7f5] text-zinc-950">
      <div className="mx-auto w-full max-w-[1480px] px-4 pb-16 pt-6 sm:px-6 sm:pt-8 lg:px-10 lg:pb-10">
        <header className="mb-8 flex flex-col justify-between gap-5 border-b border-zinc-200 pb-7 sm:flex-row sm:items-end">
          <div>
            <p className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-violet-700">
              <Film className="h-3.5 w-3.5" /> Arquivo dos assinantes
            </p>
            <h1 className="mt-3 text-3xl font-bold tracking-[-0.04em] sm:text-5xl">
              Reuniões gravadas
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-600 sm:text-base">
              Reveja análises, referências e direcionamentos das reuniões semanais.
            </p>
          </div>
          <span className="w-fit rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-800">
            Acesso D2C Pro
          </span>
        </header>

        <RecordedMeetingsLibrary meetings={meetings} />
      </div>
    </div>
  );
}
