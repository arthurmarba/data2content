import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowUpRight,
  BellRing,
  CalendarPlus,
  Check,
  Clock3,
  Eye,
  MessageCircle,
  Video,
} from "lucide-react";

import { authOptions } from "@/app/api/auth/[...nextauth]/route";
import { getWeeklyMeetingExperience } from "@/app/lib/community/weeklyMeetingService";
import { formatWeeklyMeetingDate } from "@/app/lib/community/weeklyMeeting";
import { connectToDatabase } from "@/app/lib/mongoose";
import { COMMUNITY_FREE_JOIN_ROUTE, COMMUNITY_WHATSAPP_URL } from "@/app/lib/communityLinks";
import UserModel from "@/app/models/User";
import { getPlanAccessMeta } from "@/utils/planStatus";
import { MOBILE_PROFILE_ROUTE } from "@/app/dashboard/boards/videoUpload/mobileStrategicProfileRoutes";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Reunião semanal | Data2Content",
  description: "Acesse e salve na agenda a reunião semanal da Data2Content.",
};

export default async function WeeklyMeetingPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent("/reuniao")}&intent=weekly_meeting`);
  }

  const userId = (session.user as { id?: string }).id;
  let hasPremiumAccess = false;
  if (userId) {
    await connectToDatabase();
    const user = await UserModel.findById(userId)
      .select("planStatus cancelAtPeriodEnd")
      .lean<{ planStatus?: unknown; cancelAtPeriodEnd?: boolean | null }>()
      .exec();
    hasPremiumAccess = getPlanAccessMeta(
      user?.planStatus,
      user?.cancelAtPeriodEnd,
    ).hasPremiumAccess;
  }

  const meeting = await getWeeklyMeetingExperience();
  const meetingCancelled = meeting.status === "cancelled";
  const whatsappUrl = hasPremiumAccess
    ? COMMUNITY_WHATSAPP_URL
    : COMMUNITY_FREE_JOIN_ROUTE;
  const whatsappLabel = hasPremiumAccess
    ? "Ver avisos no grupo Pro"
    : "Receber avisos no WhatsApp";

  return (
    <main className="min-h-[calc(100dvh-4rem)] bg-[#f7f7f5] px-4 py-6 text-zinc-950 sm:px-6 sm:py-10 lg:px-10">
      <div className="mx-auto max-w-5xl">
        {/* A tab bar antiga fica oculta nesta rota (chrome legada suprimida em
            DashboardShell) — este link é a única navegação de volta ao Perfil. */}
        <Link
          href={MOBILE_PROFILE_ROUTE}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-semibold text-zinc-500 transition hover:text-zinc-900"
        >
          <ArrowLeft className="h-4 w-4" /> Voltar ao perfil
        </Link>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-violet-700">
              Toda quinta-feira
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-[-0.04em] sm:text-5xl">
              Reunião semanal
            </h1>
          </div>
          <span className="hidden rounded-full border border-zinc-200 bg-white px-3 py-1.5 text-xs font-semibold text-zinc-600 sm:inline-flex">
            {hasPremiumAccess ? "Assinante D2C Pro" : "Acesso gratuito"}
          </span>
        </div>

        <section className="overflow-hidden rounded-[2rem] border border-zinc-200/80 bg-zinc-950 text-white shadow-[0_24px_70px_rgba(24,24,27,0.13)]">
          <div className="grid lg:grid-cols-[1.35fr_0.65fr]">
            <div className="px-6 py-8 sm:px-10 sm:py-12">
              <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5">
                  <Clock3 className="h-3.5 w-3.5" /> Horário previsto · 19h–21h
                </span>
                {meetingCancelled ? (
                  <span className="inline-flex items-center rounded-full bg-amber-300 px-3 py-1.5 text-zinc-950">
                    Edição cancelada
                  </span>
                ) : null}
              </div>

              <p className="mt-8 max-w-2xl text-sm font-semibold text-violet-300">
                {meetingCancelled
                  ? "Atualização desta edição"
                  : `Previsão: ${formatWeeklyMeetingDate(meeting.startAt)}`}
              </p>
              <h2 className="mt-3 max-w-2xl text-3xl font-black tracking-[-0.035em] sm:text-5xl">
                {meetingCancelled
                  ? "A reunião desta edição foi cancelada."
                  : "Conteúdo analisado de verdade, ao vivo."}
              </h2>
              <p className="mt-5 max-w-xl text-base leading-7 text-zinc-300">
                {meetingCancelled
                  ? "Confira o WhatsApp para acompanhar mudanças e a previsão da próxima edição."
                  : "Assista Arthur e Ronaldo analisarem conteúdo criador a criador. Antes de acessar, confira no WhatsApp se houve alguma mudança."}
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                {!meetingCancelled && meeting.joinUrl ? (
                  <a href={meeting.joinUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-sm font-bold text-zinc-950 transition hover:bg-violet-100">
                    <Video className="h-4 w-4" />
                    Acessar link da reunião
                    <ArrowUpRight className="h-4 w-4" />
                  </a>
                ) : !meetingCancelled ? (
                  <div className="inline-flex min-h-12 items-center justify-center rounded-full border border-white/15 bg-white/5 px-5 text-center text-sm font-semibold text-zinc-300">
                    Link ainda não disponível no app
                  </div>
                ) : null}
                <a href={whatsappUrl} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 text-sm font-bold text-zinc-950 transition hover:bg-[#34df74]">
                  <BellRing className="h-4 w-4" /> {whatsappLabel}
                  <ArrowUpRight className="h-4 w-4" />
                </a>
                {!meetingCancelled ? (
                  <a href="/api/community/meeting/calendar" className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-sm font-bold text-white transition hover:bg-white/10">
                    <CalendarPlus className="h-4 w-4" /> Salvar previsão na agenda
                  </a>
                ) : null}
              </div>
            </div>

            <aside className="border-t border-white/10 bg-white/[0.055] px-6 py-8 lg:border-l lg:border-t-0 lg:px-8 lg:py-12">
              <p className="text-xs font-bold uppercase tracking-[0.17em] text-zinc-400">Seu acesso</p>
              <h3 className="mt-3 text-xl font-bold">
                {hasPremiumAccess ? "Você participa por inteiro" : "Você pode assistir sempre"}
              </h3>
              <ul className="mt-6 space-y-4 text-sm leading-6 text-zinc-300">
                <li className="flex gap-3"><BellRing className="mt-1 h-4 w-4 shrink-0 text-violet-300" /> Mudanças e cancelamentos são informados primeiro pelo WhatsApp.</li>
                <li className="flex gap-3"><Eye className="mt-1 h-4 w-4 shrink-0 text-violet-300" /> Gratuito e Pro podem assistir às reuniões confirmadas.</li>
                <li className="flex gap-3"><Check className="mt-1 h-4 w-4 shrink-0 text-violet-300" /> Assinantes que confirmam no grupo são analisados.</li>
                <li className="flex gap-3"><MessageCircle className="mt-1 h-4 w-4 shrink-0 text-violet-300" /> O grupo de assinantes organiza a confirmação.</li>
              </ul>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[1.5rem] border border-zinc-200 bg-white p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-zinc-400">Acesso gratuito</p>
            <h2 className="mt-3 text-xl font-bold">Assista, aprenda e volte toda semana.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Você não precisa assinar para acompanhar. Entre no canal gratuito para receber o link e saber se a previsão mudou.</p>
          </div>

          <div className="rounded-[1.5rem] border border-violet-200 bg-violet-50 p-6">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-700">Experiência Pro</p>
            <h2 className="mt-3 text-xl font-bold">Análise, grupo e plataforma completa.</h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">Confirme presença no grupo para ser analisado e use seu Mapa, pautas, collabs e ferramentas entre as reuniões.</p>
            {hasPremiumAccess ? (
              <a href={COMMUNITY_WHATSAPP_URL} target="_blank" rel="noreferrer" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-800">
                Confirmar no grupo de assinantes <ArrowUpRight className="h-4 w-4" />
              </a>
            ) : (
              <Link href="/pro" className="mt-5 inline-flex items-center gap-2 text-sm font-bold text-violet-800">
                Conhecer o D2C Pro <ArrowUpRight className="h-4 w-4" />
              </Link>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
