import type { ReactNode } from "react";
import type { NarrativeMapAccessState } from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";

interface Props {
  accessState: NarrativeMapAccessState;
  instagramConnected?: boolean;
  onNewReading: () => void;
  onConnectInstagram?: () => void;
  onUpgrade?: () => void;
}

export function DiagnosticoEmptyState({
  accessState,
  instagramConnected = false,
  onNewReading,
  onConnectInstagram,
  onUpgrade,
}: Props) {
  if (accessState === "pro_needs_instagram") {
    return (
      <EmptyStateShell
        icon={<InstagramGlyph />}
        title="Conecte para melhorar a precisão"
        description="Seu Pro já está ativo. Com Instagram conectado, a D2C cruza a análise com sinais reais do seu perfil."
      >
        {onConnectInstagram && (
          <button
            onClick={onConnectInstagram}
            className="w-full max-w-xs rounded-full bg-zinc-950 py-3.5 text-[14px] font-semibold text-white"
          >
            Conectar Instagram
          </button>
        )}
      </EmptyStateShell>
    );
  }

  if (accessState === "free_preview_used") {
    return (
      <EmptyStateShell
        icon={<LimitGlyph />}
        title="Sua análise gratuita foi usada"
        description="Assine para continuar comparando novos vídeos e fortalecer seu diagnóstico."
      >
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="w-full max-w-xs rounded-full bg-zinc-950 py-3.5 text-[14px] font-semibold text-white"
          >
            Continuar com assinatura
          </button>
        )}
      </EmptyStateShell>
    );
  }

  if (accessState === "payment_pending") {
    return (
      <EmptyStateShell
        icon={<LimitGlyph />}
        title="Estamos confirmando seu pagamento"
        description="Assim que a confirmação chegar, novas análises ficam disponíveis automaticamente."
      >
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="w-full max-w-xs rounded-full bg-zinc-950 py-3.5 text-[14px] font-semibold text-white"
          >
            Acompanhar pagamento
          </button>
        )}
      </EmptyStateShell>
    );
  }

  if (accessState === "payment_action_needed") {
    return (
      <EmptyStateShell
        icon={<LimitGlyph />}
        title="Atualize sua forma de pagamento"
        description="Seu diagnóstico continua salvo. Atualize o pagamento para liberar novas análises."
      >
        {onUpgrade && (
          <button
            onClick={onUpgrade}
            className="w-full max-w-xs rounded-full bg-zinc-950 py-3.5 text-[14px] font-semibold text-white"
          >
            Atualizar pagamento
          </button>
        )}
      </EmptyStateShell>
    );
  }

  if (accessState === "pro_quota_reached") {
    return (
      <EmptyStateShell
        icon={<LimitGlyph />}
        title="Limite mensal usado"
        description="Você usou todas as análises deste ciclo. Seu diagnóstico continua disponível e volta a evoluir na renovação."
      />
    );
  }

  if (instagramConnected) {
    return (
      <EmptyStateShell
        icon={<PulseGlyph />}
        title="Tudo pronto para começar"
        description="Seu Instagram já está conectado. Agora envie um vídeo para gerar a primeira análise."
      >
        <button
          onClick={onNewReading}
          className="w-full max-w-xs rounded-full bg-zinc-950 py-4 text-[15px] font-bold text-white shadow-[0_4px_16px_rgba(9,9,11,0.25)]"
        >
          Analisar primeiro vídeo
        </button>
      </EmptyStateShell>
    );
  }

  return (
    <EmptyStateShell
      icon={<PulseGlyph />}
      title="Comece sua primeira análise"
      description="Você tem 1 crédito gratuito para enviar um vídeo e testar a leitura da D2C."
      footer="Use um vídeo do Instagram, TikTok ou câmera do celular."
    >
      <button
        onClick={onNewReading}
        className="w-full max-w-xs rounded-full bg-zinc-950 py-4 text-[15px] font-bold text-white shadow-[0_4px_16px_rgba(9,9,11,0.25)]"
      >
        Analisar primeiro vídeo
      </button>
    </EmptyStateShell>
  );
}

function EmptyStateShell({
  icon,
  title,
  description,
  footer,
  children,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  footer?: string;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-5 rounded-[32px] bg-white px-6 py-10 text-center shadow-[0_1px_2px_rgba(15,23,42,0.025),0_18px_42px_rgba(15,23,42,0.04)] ring-1 ring-black/[0.025]">
      <div className="flex h-20 w-20 items-center justify-center rounded-full bg-zinc-100">
        {icon}
      </div>

      <div>
        <p className="text-[22px] font-bold leading-snug text-zinc-950">
          {title}
        </p>
        <p className="mx-auto mt-2.5 max-w-xs text-[15px] leading-relaxed text-zinc-500">
          {description}
        </p>
      </div>

      {children}

      {footer ? (
        <p className="max-w-[15rem] text-[12px] leading-snug text-zinc-400">
          {footer}
        </p>
      ) : null}
    </div>
  );
}

function InstagramGlyph() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <rect x="2" y="2" width="20" height="20" rx="5" stroke="#71717a" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="4" stroke="#71717a" strokeWidth="1.7" />
      <circle cx="17.5" cy="6.5" r="1" fill="#71717a" />
    </svg>
  );
}

function LimitGlyph() {
  return (
    <svg width="34" height="34" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="10" stroke="#71717a" strokeWidth="1.7" />
      <path d="M12 8v4M12 16h.01" stroke="#71717a" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function PulseGlyph() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <path
        d="M4 22h6l4.5-14 5 18 4.5-10.5L27 22h9"
        stroke="#09090b"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
