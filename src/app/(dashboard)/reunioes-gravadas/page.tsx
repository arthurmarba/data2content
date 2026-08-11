import type { Metadata } from "next";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Film } from "lucide-react";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import RecordedMeetingsLibrary from "@/app/dashboard/recorded-meetings/RecordedMeetingsLibrary";
import { canAccessRecordedMeetings } from "@/app/lib/community/recordedMeetingsAccess";
import {
  getRecordedMeetingsState,
  type RecordedMeetingsResult,
} from "@/app/lib/community/recordedMeetingsService";
import { RECORDED_MEETINGS_ROUTE } from "@/constants/routes";
import { MOBILE_PROFILE_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";

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

  let library: RecordedMeetingsResult = { status: "unavailable", meetings: [] };
  try {
    library = await getRecordedMeetingsState();
    if (library.status === "unconfigured") {
      console.error(
        "[recorded-meetings-page] Configuração ausente:",
        library.missingConfiguration?.join(", "),
      );
    }
  } catch (error) {
    console.error("[recorded-meetings-page] Falha ao carregar playlist:", error);
  }

  return (
    // Fundo bege quente e vermelho da marca: vindo do Perfil, a pessoa continua
    // dentro do mesmo produto. Antes era cinza frio com destaques em roxo.
    <div
      className="h-full min-h-0 overflow-y-auto bg-[#f1ebe1] text-[#17140f]"
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
    >
      <div className="mx-auto w-full max-w-[1480px] px-4 pb-16 pt-4 sm:px-6 sm:pt-8 lg:px-10 lg:pb-10">
        {/* Esta rota vive fora da casca do app mobile, que tem barra de abas.
            Sem este link, quem chega do Perfil fica sem caminho de volta. */}
        <Link
          href={MOBILE_PROFILE_ROUTE}
          className="-ml-1 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-1 text-sm font-semibold text-[#6b6157] transition active:bg-black/5 hover:text-[#17140f]"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Voltar ao perfil
        </Link>

        <header className="mb-6 mt-3 flex flex-col justify-between gap-4 border-b border-[#e7e1d8] pb-5 sm:mb-8 sm:flex-row sm:items-end sm:pb-7">
          <div>
            <p className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.18em] text-[#c70a42]">
              <Film className="h-3.5 w-3.5" /> Arquivo dos assinantes
            </p>
            <h1 className="mt-2 text-[2rem] font-bold tracking-[-0.04em] sm:mt-3 sm:text-5xl">
              Reuniões gravadas
            </h1>
            {/* O subtítulo explicativo custava 170px no celular para dizer o que
                a pessoa acabou de ler no botão. Some no telefone. */}
            <p className="mt-3 hidden max-w-2xl text-sm leading-6 text-[#423b33] sm:block sm:text-base">
              Reveja análises, referências e direcionamentos das reuniões semanais.
            </p>
          </div>
          <span className="hidden w-fit rounded-full border border-[#e7e1d8] bg-white px-3 py-1.5 text-xs font-semibold text-[#423b33] sm:inline-flex">
            Acesso D2C Pro
          </span>
        </header>

        <RecordedMeetingsLibrary meetings={library.meetings} status={library.status} />
      </div>
    </div>
  );
}
