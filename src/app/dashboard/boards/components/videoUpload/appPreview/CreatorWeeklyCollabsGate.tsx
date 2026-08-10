"use client";

import type { NarrativeMapAccessState } from "@/app/dashboard/boards/videoUpload/narrativeMapAccessState";
import type { PaywallContext } from "@/types/paywall";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";

export function CreatorWeeklyCollabsGate({
  accessState,
  isDemo,
  onUpgrade,
  onConnectInstagram,
  onDemoChange,
}: {
  accessState: NarrativeMapAccessState;
  isDemo: boolean;
  onUpgrade: (context?: PaywallContext) => void;
  onConnectInstagram: () => void;
  onDemoChange: (demo: boolean) => void;
}) {
  const isProNeedsInstagram = accessState === "pro_needs_instagram";
  const billingAttention = accessState === "payment_pending" || accessState === "payment_action_needed";
  const changeDemo = (next: boolean) => {
    trackMobileNarrativeEvent(
      next ? "mobile_weekly_report_demo_opened" : "mobile_weekly_report_demo_closed",
      {
        route: "/dashboard/boards/mobile-strategic-profile",
        accessState,
        actionType: "collabs",
      },
    );
    onDemoChange(next);
  };

  if (isDemo) {
    return (
      <main className="mx-auto w-full max-w-[32rem] px-5 pb-8 pt-[var(--ds-safe-top)] ds-analysis-editorial">
        <header>
          <div className="flex items-center gap-2">
            <span className="ds-eyebrow">Collabs</span>
            <span className="ds-badge ds-badge--neutral">Exemplo</span>
          </div>
          <h1 className="mt-2 text-[2rem] font-bold leading-none text-[var(--ds-color-ink)]">Uma pauta, duas casas.</h1>
          <p className="ds-body mt-2">O exemplo mostra como o encaixe é explicado antes de qualquer convite.</p>
        </header>

        <section className="ds-editorial-panel mt-6 p-5">
          <span className="ds-eyebrow">Por que combina</span>
          <h2 className="mt-3 text-[1.4rem] font-bold leading-[1.08] text-[var(--ds-color-ink)]">
            Vocês falam de rotina real por ângulos diferentes.
          </h2>
          <p className="ds-body mt-3">Uma mostra a decisão por dentro; a outra transforma a mesma situação em passo prático.</p>
          <div className="mt-5 border-t border-[var(--ds-color-line)] pt-4">
            <span className="ds-eyebrow">Como gravar</span>
            <ol className="mt-3 space-y-3 text-[14px] leading-[1.45] text-[var(--ds-color-ink)]">
              <li className="flex gap-3"><b>1.</b><span>Cada uma grava em casa a mesma pergunta.</span></li>
              <li className="flex gap-3"><b>2.</b><span>As respostas se alternam em cortes curtos.</span></li>
              <li className="flex gap-3"><b>3.</b><span>A conclusão aponta o que as duas aprenderam.</span></li>
            </ol>
          </div>
        </section>

        <button type="button" className="ds-button ds-button--quiet ds-button--block mt-5" onClick={() => changeDemo(false)}>
          Sair do exemplo
        </button>
      </main>
    );
  }

  return (
    <main className="mx-auto w-full max-w-[32rem] px-5 pb-8 pt-[var(--ds-safe-top)] ds-analysis-editorial">
      <header>
        <span className="ds-eyebrow">Collabs</span>
        <h1 className="mt-2 text-[2rem] font-bold leading-none text-[var(--ds-color-ink)]">Criadores que combinam com você</h1>
      </header>

      <section className="ds-editorial-panel mt-6 p-5">
        <span className="ds-eyebrow">Ainda não dá</span>
        <h2 className="mt-3 text-[1.45rem] font-bold leading-[1.08] text-[var(--ds-color-ink)]">
          Para achar quem combina com você, a D2C precisa ver os seus vídeos.
        </h2>
        <p className="ds-body mt-3">A combinação é por assunto e jeito de gravar — não por número de seguidores.</p>
        <button
          type="button"
          className="ds-button ds-button--primary mt-5"
          onClick={isProNeedsInstagram ? onConnectInstagram : () => onUpgrade(billingAttention ? "narrative_map" : "planning")}
        >
          {isProNeedsInstagram ? "Conectar Instagram" : billingAttention ? "Resolver pagamento" : "Assinar Pro"}
        </button>
      </section>

      <section className="mt-7 border-t border-[var(--ds-color-line)] pt-6">
        <span className="ds-eyebrow">Veja por dentro</span>
        <h2 className="mt-2 text-[1.35rem] font-bold leading-tight text-[var(--ds-color-ink)]">O exemplo também tem as collabs.</h2>
        <p className="ds-body mt-2">Veja quem combina com quem, por quê e o passo a passo para gravar.</p>
        <button type="button" className="ds-button ds-button--quiet mt-4" onClick={() => changeDemo(true)}>
          Ver exemplo
        </button>
      </section>
    </main>
  );
}
