"use client";

import type { NarrativeMapAccessState } from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";

interface Props {
  accessState: NarrativeMapAccessState;
  instagramConnected: boolean;
  onConnectInstagram?: () => void;
  onUpgrade?: () => void;
}

interface Preview {
  id: string;
  title: string;
  description: string;
}

type CardVariant = "premium" | "instagram" | "payment_pending" | "payment_action" | "none";

/**
 * Adaptive driver card — switches between Premium upsell, Instagram tease,
 * and payment status messaging depending on the user's actual state.
 *
 * Defensive: if Instagram is connected, user is at top tier → render nothing.
 */
export function DiagnosticoLockedPreviewsCard({
  accessState,
  instagramConnected,
  onConnectInstagram,
  onUpgrade,
}: Props) {
  const variant = resolveVariant(accessState, instagramConnected);
  if (variant === "none") return null;

  if (variant === "payment_pending") {
    return (
      <PaymentStatusCard
        chip="PAGAMENTO PROCESSANDO"
        chipColor="text-amber-700"
        iconBg="bg-amber-500"
        icon={<ClockIcon />}
        headline="Estamos confirmando seu pagamento"
        description="Assim que confirmar, suas análises voltam ao normal automaticamente. Costuma levar alguns minutos."
        ctaLabel="Acompanhar status"
        ctaBorder="border-amber-500"
        ctaText="text-amber-600"
        ctaActive="active:bg-amber-50"
        onCta={onUpgrade}
      />
    );
  }

  if (variant === "payment_action") {
    return (
      <PaymentStatusCard
        chip="AÇÃO NECESSÁRIA"
        chipColor="text-rose-700"
        iconBg="bg-rose-500"
        icon={<AlertIcon />}
        headline="Atualize sua forma de pagamento"
        description="Suas análises Premium podem ser interrompidas. Atualize o pagamento para continuar sem interrupção."
        ctaLabel="Atualizar pagamento"
        ctaBorder="border-rose-500"
        ctaText="text-rose-600"
        ctaActive="active:bg-rose-50"
        onCta={onUpgrade}
      />
    );
  }

  const previews = variant === "premium" ? PREMIUM_PREVIEWS : INSTAGRAM_PREVIEWS;
  const accent = variant === "premium"
    ? { iconBg: "bg-amber-500", chip: "PREMIUM", chipColor: "text-amber-600", ctaBorder: "border-amber-500", ctaText: "text-amber-600", ctaActive: "active:bg-amber-50", ctaLabel: "Conhecer Premium" }
    : { iconBg: "bg-pink-500",  chip: "INSTAGRAM", chipColor: "text-pink-600", ctaBorder: "border-pink-500", ctaText: "text-pink-600", ctaActive: "active:bg-pink-50", ctaLabel: "Conectar Instagram" };

  const handleCtaClick = () => {
    if (variant === "instagram") onConnectInstagram?.();
    else onUpgrade?.();
  };

  return (
    <div className="w-full rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${accent.iconBg}`}>
            <LockIcon />
          </div>
          <span className={`text-[12px] font-semibold tracking-tight ${accent.chipColor}`}>
            {accent.chip}
          </span>
        </div>

        <p className="text-[17px] font-bold text-zinc-950 leading-snug">
          O que mais você pode desbloquear
        </p>

        <ul className="mt-3 flex flex-col gap-2.5">
          {previews.map((preview) => (
            <li key={preview.id} className="flex gap-2.5">
              <div className="shrink-0 mt-1 h-1.5 w-1.5 rounded-full bg-zinc-300" />
              <div className="flex-1 min-w-0">
                <p className="text-[14px] font-semibold text-zinc-900 leading-snug">{preview.title}</p>
                <p className="mt-0.5 text-[13px] text-zinc-500 leading-snug">{preview.description}</p>
              </div>
            </li>
          ))}
        </ul>

        <button
          onClick={handleCtaClick}
          className={`mt-4 w-full rounded-full border ${accent.ctaBorder} bg-white py-2.5 text-[14px] font-semibold ${accent.ctaText} ${accent.ctaActive}`}
        >
          {accent.ctaLabel}
        </button>
      </div>
    </div>
  );
}

function PaymentStatusCard({
  chip,
  chipColor,
  iconBg,
  icon,
  headline,
  description,
  ctaLabel,
  ctaBorder,
  ctaText,
  ctaActive,
  onCta,
}: {
  chip: string;
  chipColor: string;
  iconBg: string;
  icon: React.ReactNode;
  headline: string;
  description: string;
  ctaLabel: string;
  ctaBorder: string;
  ctaText: string;
  ctaActive: string;
  onCta?: () => void;
}) {
  return (
    <div className="w-full rounded-2xl bg-white shadow-[0_2px_8px_rgba(0,0,0,0.06)] overflow-hidden">
      <div className="p-4">
        <div className="mb-3 flex items-center gap-2">
          <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-lg ${iconBg}`}>
            {icon}
          </div>
          <span className={`text-[12px] font-semibold tracking-tight ${chipColor}`}>{chip}</span>
        </div>
        <p className="text-[17px] font-bold text-zinc-950 leading-snug">{headline}</p>
        <p className="mt-2 text-[14px] text-zinc-600 leading-snug">{description}</p>
        {onCta && (
          <button
            onClick={onCta}
            className={`mt-4 w-full rounded-full border ${ctaBorder} bg-white py-2.5 text-[14px] font-semibold ${ctaText} ${ctaActive}`}
          >
            {ctaLabel}
          </button>
        )}
      </div>
    </div>
  );
}

function resolveVariant(
  accessState: NarrativeMapAccessState,
  instagramConnected: boolean,
): CardVariant {
  // Defensive: Instagram connected ⇒ top tier ⇒ nothing to unlock
  if (instagramConnected) return "none";
  // Admin: top tier without IG dependency
  if (accessState === "admin") return "none";
  // Payment status takes priority over upgrade prompts
  if (accessState === "payment_pending") return "payment_pending";
  if (accessState === "payment_action_needed") return "payment_action";
  // Pro user without IG → tease Instagram (includes pro_quota_reached as path forward)
  if (
    accessState === "pro_instagram_connected" ||
    accessState === "pro_needs_instagram" ||
    accessState === "pro_quota_reached"
  ) {
    return "instagram";
  }
  // Free user → tease Premium
  if (accessState === "free_unused" || accessState === "free_preview_used") {
    return "premium";
  }
  return "none";
}

const PREMIUM_PREVIEWS: Preview[] = [
  {
    id: "unlimited_readings",
    title: "Análises ilimitadas",
    description: "Premium libera leituras mensais para seu diagnóstico evoluir continuamente.",
  },
  {
    id: "execution_patterns",
    title: "Padrões de execução e oportunidades comerciais",
    description: "Agregações de fala, produção e territórios de marca em todos os seus vídeos.",
  },
];

const INSTAGRAM_PREVIEWS: Preview[] = [
  {
    id: "instagram_reach",
    title: "Leitura cruzada com Instagram",
    description: "Conectando, sua análise se cruza com alcance e engajamento reais.",
  },
  {
    id: "format_benchmarks",
    title: "Comparativo de formatos",
    description: "Ver como sua audiência responde a cada formato no seu perfil.",
  },
];

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="4" y="11" width="16" height="10" rx="2" stroke="white" strokeWidth="1.8" />
      <path d="M8 11V7a4 4 0 0 1 8 0v4" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="white" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" stroke="white" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M12 9v4M12 17h.01" stroke="white" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
