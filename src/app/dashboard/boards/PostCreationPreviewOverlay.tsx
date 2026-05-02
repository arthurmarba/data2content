"use client";

import React from "react";
import {
  ArrowRight,
  BarChart3,
  BriefcaseBusiness,
  CalendarDays,
  Eye,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  Smile,
  Sparkles,
  Target,
  Users,
  Video,
} from "lucide-react";
import { motion } from "framer-motion";
import Image from "next/image";

const BRAND_PINK = "#F6007B";

function TrustChips() {
  const trustItems = [
    {
      label: "Modo leitura",
      icon: Eye,
    },
    {
      label: "Não publica",
      icon: LockKeyhole,
    },
    {
      label: "API oficial Meta",
      icon: ShieldCheck,
    },
  ];

  return (
    <div className="mt-4 grid grid-cols-3 gap-2">
      {trustItems.map((item) => (
        <div
          key={item.label}
          className="flex min-h-[3.25rem] flex-col items-center justify-center gap-1.5 rounded-[16px] border border-zinc-200/80 bg-white/78 px-2 py-2 text-center shadow-[0_10px_24px_rgba(15,23,42,0.035)] min-[520px]:flex-row min-[520px]:justify-start min-[520px]:gap-2.5 min-[520px]:px-3 min-[520px]:text-left"
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 min-[520px]:h-8 min-[520px]:w-8">
            <item.icon className="h-3.5 w-3.5 min-[520px]:h-4 min-[520px]:w-4" aria-hidden="true" />
          </span>
          <span className="text-[9.5px] font-bold leading-3 text-zinc-600 min-[520px]:text-[12px] min-[520px]:leading-4">{item.label}</span>
        </div>
      ))}
    </div>
  );
}

const collabCreators = [
  {
    name: "Rafa",
    src: "/images/Rafa%20Belli%20Foto%20D2C.png",
  },
  {
    name: "Livia",
    src: "/images/Livia%20Foto%20D2C.png",
  },
  {
    name: "Criador",
    src: "/images/default-profile.png",
  },
];

function ResultPreviewCard() {
  const detailItems = [
    {
      label: "Contexto",
      value: "Carreira",
      icon: BriefcaseBusiness,
      tone: "text-indigo-600 bg-indigo-50 ring-indigo-100",
    },
    {
      label: "Proposta",
      value: "Bastidores",
      icon: MessageCircle,
      tone: "text-[#F6007B] bg-pink-50 ring-pink-100",
    },
    {
      label: "Formato",
      value: "Reel",
      icon: Video,
      tone: "text-[#F6007B] bg-pink-50 ring-pink-100",
    },
    {
      label: "Intenção",
      value: "Autoridade",
      icon: Target,
      tone: "text-violet-600 bg-violet-50 ring-violet-100",
    },
    {
      label: "Narrativa",
      value: "Rotina/Vlog",
      icon: Smile,
      tone: "text-amber-600 bg-amber-50 ring-amber-100",
    },
    {
      label: "Quando",
      value: "Ter. 09h",
      icon: CalendarDays,
      tone: "text-emerald-700 bg-emerald-50 ring-emerald-100",
    },
  ];

  return (
    <section className="mt-4 rounded-[26px] border border-pink-200/70 bg-white px-4 py-4 shadow-[0_22px_50px_rgba(246,0,123,0.08)] sm:px-5 sm:py-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[10px] font-black uppercase text-[#F6007B]">
          Exemplo de entrega
        </p>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-pink-50 px-2.5 py-1 text-[10px] font-black uppercase text-[#F6007B] ring-1 ring-pink-100">
          <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
          Carreira
        </span>
      </div>

      <div className="mt-3 rounded-[20px] bg-zinc-50/70 px-4 py-4 ring-1 ring-zinc-100">
        <h2 className="text-[1.25rem] font-black leading-[1.12] text-zinc-950 sm:text-[1.45rem]">
          POV: como eu organizo uma semana caótica sem travar minha carreira
        </h2>
        <p className="mt-2 text-[12px] font-semibold leading-5 text-zinc-600">
          Grave em rotina/vlog: mostre o bastidor real, o critério por trás das escolhas e feche com um aprendizado prático.
        </p>

        <div className="mt-4 flex items-end justify-between gap-4">
          <div>
            <p className="text-[9px] font-black uppercase text-zinc-400">
              Alcance provável
            </p>
            <div className="mt-1 flex items-end gap-2">
              <span className="text-[2.35rem] font-black leading-none text-[#F6007B] sm:text-[3rem]">
                75 mil
              </span>
              <span className="mb-1 flex h-8 w-8 items-center justify-center rounded-[12px] bg-pink-50 text-[#F6007B] ring-1 ring-pink-100 sm:h-9 sm:w-9">
                <BarChart3 className="h-4 w-4 sm:h-5 sm:w-5" aria-hidden="true" />
              </span>
            </div>
          </div>
          <div className="rounded-[16px] bg-white px-3 py-2 text-right ring-1 ring-zinc-200/70">
            <p className="text-[10px] font-black uppercase text-zinc-400">Confiança</p>
            <p className="mt-0.5 text-[13px] font-black text-zinc-950">alta</p>
          </div>
        </div>
      </div>

      <div className="mt-3 rounded-[18px] border border-zinc-200/75 bg-white px-3 py-3 shadow-[0_10px_26px_rgba(15,23,42,0.035)]">
        <div className="flex items-center gap-3">
          <div className="flex shrink-0 -space-x-2">
            {collabCreators.map((creator) => (
              <span
                key={creator.name}
                className="relative block h-9 w-9 overflow-hidden rounded-full border-2 border-white bg-zinc-100 shadow-sm ring-1 ring-zinc-200/70"
              >
                <Image
                  src={creator.src}
                  alt=""
                  fill
                  className="object-cover"
                  sizes="36px"
                />
              </span>
            ))}
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 shrink-0 text-[#F6007B]" aria-hidden="true" />
              <p className="text-[10px] font-black uppercase text-zinc-400">Collabs ideais</p>
            </div>
            <p className="mt-0.5 text-[12px] font-black leading-4 text-zinc-950">
              3 criadores compatíveis com essa pauta.
            </p>
            <p className="mt-0.5 text-[10.5px] font-semibold leading-4 text-zinc-500">
              Audiência próxima + contexto parecido.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-1.5 min-[430px]:gap-2">
        {detailItems.map((item) => (
          <div
            key={item.label}
            className="flex min-h-[3.55rem] flex-col items-center justify-center gap-1 rounded-[14px] border border-zinc-200/75 bg-white px-1.5 py-2 text-center shadow-[0_8px_20px_rgba(15,23,42,0.025)] min-[520px]:flex-row min-[520px]:justify-start min-[520px]:gap-2 min-[520px]:px-3 min-[520px]:text-left"
          >
            <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ring-1 min-[520px]:h-8 min-[520px]:w-8 ${item.tone}`}>
              <item.icon className="h-3.5 w-3.5 min-[520px]:h-4 min-[520px]:w-4" aria-hidden="true" />
            </span>
            <span className="text-[9.5px] font-semibold leading-3 text-zinc-500 min-[520px]:text-[11px] min-[520px]:leading-4">{item.label}</span>
            <strong className="text-[11px] font-black leading-3 text-zinc-950 min-[520px]:text-[12px]">{item.value}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

function ConsentCta({
  acceptedLegal,
  activationError,
  activationPending,
  attemptedSubmit,
  onActivate,
  onSubmit,
  setAcceptedLegal,
}: {
  acceptedLegal: boolean;
  activationError: string | null;
  activationPending: boolean;
  attemptedSubmit: boolean;
  onActivate: (acceptedLegal: boolean) => void;
  onSubmit: () => void;
  setAcceptedLegal: (acceptedLegal: boolean) => void;
}) {
  const showConsentNudge = attemptedSubmit && !acceptedLegal;

  return (
    <section className="mt-4 pb-1">
      <label
        className={`flex cursor-pointer items-start gap-3 rounded-[18px] px-0 py-1 text-left transition ${
          showConsentNudge ? "text-[#F6007B]" : "text-zinc-600"
        }`}
      >
        <input
          type="checkbox"
          checked={acceptedLegal}
          onChange={(event) => {
            setAcceptedLegal(event.target.checked);
          }}
          aria-describedby={showConsentNudge && !activationError ? "post-creation-consent-helper" : undefined}
          className="mt-0.5 h-6 w-6 shrink-0 rounded-md border-zinc-300 text-[#F6007B] focus:ring-[#F6007B]"
        />
        <span className="text-[12px] font-semibold leading-5">
          Aceito os{" "}
          <a
            href="/termos-e-condicoes"
            target="_blank"
            className="font-black text-zinc-800 underline underline-offset-2"
          >
            Termos
          </a>
          {" "}e a{" "}
          <a
            href="/politica-de-privacidade"
            target="_blank"
            className="font-black text-zinc-800 underline underline-offset-2"
          >
            Política de Privacidade
          </a>{" "}
          para iniciar o teste.
        </span>
      </label>

      <button
        type="button"
        onClick={() => {
          onSubmit();
          onActivate(acceptedLegal);
        }}
        disabled={activationPending}
        className="group relative mt-4 inline-flex min-h-[4rem] w-full items-center justify-center gap-3 overflow-hidden rounded-full bg-[#F6007B] px-5 py-4 text-[18px] font-black !text-white shadow-[0_18px_40px_rgba(246,0,123,0.26)] transition-all hover:-translate-y-0.5 hover:bg-[#e60073] hover:shadow-[0_24px_48px_rgba(246,0,123,0.3)] active:scale-[0.98] disabled:cursor-wait disabled:opacity-80"
        style={{ color: "#ffffff" }}
      >
        <span className="relative z-10 !text-white" style={{ color: "#ffffff" }}>
          {activationPending
            ? "Abrindo Meta..."
            : "Gerar minha pauta grátis"}
        </span>
        <ArrowRight
          className="relative z-10 h-6 w-6 !text-white transition-transform group-hover:translate-x-1"
          style={{ color: "#ffffff" }}
        />
        <div className="absolute inset-0 -z-0 -translate-x-full bg-gradient-to-r from-transparent via-white/18 to-transparent transition-transform duration-1000 group-hover:translate-x-full" />
      </button>

      {showConsentNudge && !activationError ? (
        <p id="post-creation-consent-helper" className="mt-2 text-center text-[11px] font-bold leading-4 text-[#F6007B]">
          Aceite os termos para iniciar o teste.
        </p>
      ) : null}

      {activationError ? (
        <p className="mt-3 rounded-[16px] border border-red-100 bg-red-50 px-4 py-3 text-[12px] font-bold leading-relaxed text-red-700">
          {activationError}
        </p>
      ) : null}

      <p className="mt-3 text-center text-[12px] font-black leading-4 text-zinc-500">
        Resultado em poucos minutos.
      </p>
    </section>
  );
}

export default function PostCreationPreviewOverlay({
  onActivate,
  activationPending = false,
  activationError = null,
}: {
  onActivate: (acceptedLegal: boolean) => void;
  activationPending?: boolean;
  activationError?: string | null;
}) {
  const [acceptedLegal, setAcceptedLegal] = React.useState(false);
  const [attemptedSubmit, setAttemptedSubmit] = React.useState(false);

  return (
    <div className="absolute inset-0 z-[190] overflow-y-auto rounded-[2rem] bg-white text-zinc-950 backdrop-blur-[10px]">
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(180deg,#ffffff_0%,#fbfbfc_52%,#f7f8fb_100%)]" />

      <div className="relative mx-auto flex min-h-full w-full max-w-[46rem] flex-col px-5 py-4 pb-[calc(env(safe-area-inset-bottom,0px)+6.25rem)] sm:px-7 sm:py-7 lg:pb-8">
        <div className="flex items-center justify-between gap-4">
          <span className="inline-flex min-w-0 items-center gap-2">
            <span className="relative inline-block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-white shadow-sm ring-1 ring-zinc-200/70 min-[430px]:h-10 min-[430px]:w-10">
              <Image
                src="/images/Colorido-Simbolo.png"
                alt=""
                fill
                className="scale-[2.25] object-contain object-center"
                priority
              />
            </span>
            <span className="text-[22px] font-black text-zinc-950">
              data2content
            </span>
          </span>
          <span className="shrink-0 rounded-full border border-zinc-200/80 bg-white/86 px-4 py-2 text-[11px] font-black uppercase text-[#F6007B] shadow-[0_12px_30px_rgba(15,23,42,0.04)]">
            Teste grátis
          </span>
        </div>

        <motion.div
          initial={{ y: 18, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.42, ease: "easeOut" }}
          className="mt-6 flex flex-1 flex-col min-[430px]:mt-8"
        >
          <div className="max-w-[42rem]">
            <h1 className="text-[2.12rem] font-black leading-[0.98] text-zinc-950 min-[430px]:text-[2.35rem] sm:text-[4rem]">
              <span className="block">Receba uma pauta pronta</span>
              <span className="block">para seu <span style={{ color: BRAND_PINK }}>Instagram</span></span>
            </h1>
            <p className="mt-4 max-w-[38rem] text-[15px] font-semibold leading-6 text-zinc-600 sm:text-[18px] sm:leading-7">
              Analisamos seu histórico em modo leitura e devolvemos uma direção clara para criar.
            </p>
          </div>

          <TrustChips />
          <ResultPreviewCard />

          <ConsentCta
            acceptedLegal={acceptedLegal}
            activationError={activationError}
            activationPending={activationPending}
            attemptedSubmit={attemptedSubmit}
            onActivate={onActivate}
            onSubmit={() => setAttemptedSubmit(true)}
            setAcceptedLegal={(nextAcceptedLegal) => {
              setAcceptedLegal(nextAcceptedLegal);
              if (nextAcceptedLegal) {
                setAttemptedSubmit(false);
              }
            }}
          />
        </motion.div>
      </div>
    </div>
  );
}
