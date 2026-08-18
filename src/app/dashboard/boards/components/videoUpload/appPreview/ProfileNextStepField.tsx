"use client";

import type { DiagnosticoPageData } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";
import type { InstagramConnectionState } from "@/app/dashboard/boards/videoUpload/instagramConnectionState";
import type { PaywallContext } from "@/types/paywall";

/**
 * O campo de próximo passo — um onboarding que roda dentro do produto.
 *
 * Não é uma barra de botões parada no topo: assinar e conectar acontecem uma vez
 * na vida, e viveriam como móvel morto no lugar mais nobre da tela. Aqui o campo
 * lê o estado da conta e troca de função — pede o plano, depois pede o Instagram,
 * depois vira uma linha de confirmação — e volta a pedir quando a conexão cai,
 * que é o único motivo pelo qual ele merece existir para sempre.
 *
 * Comunidade e reuniões NÃO entram aqui: são lugares permanentes, não etapas.
 */

export type NextStepFieldState =
  | "define_north"
  | "billing"
  | "subscribe"
  | "connect_instagram"
  | "reconnect_instagram"
  | "connected"
  | "none";

/**
 * Precedência, de cima para baixo:
 *   1. cobrança — nada mais importa enquanto o pagamento trava o serviço;
 *   2. reconexão — um serviço pago que parou de entregar em silêncio;
 *   3. Norte — sem narrativa, nem a oferta nem a leitura têm em que se apoiar;
 *   4. plano; 5. primeira conexão; 6. tudo certo, vira confirmação.
 */
export function resolveNextStepFieldState({
  accessState,
  hasActivePro,
  hasStarterMap,
  instagramConnectionState,
}: {
  accessState: DiagnosticoPageData["accessState"];
  hasActivePro: boolean;
  hasStarterMap: boolean;
  instagramConnectionState: InstagramConnectionState;
}): NextStepFieldState {
  if (accessState === "payment_pending" || accessState === "payment_action_needed") return "billing";
  if (hasActivePro && instagramConnectionState === "expired") return "reconnect_instagram";
  if (!hasStarterMap) return "define_north";
  if (!hasActivePro) return "subscribe";
  if (instagramConnectionState === "disconnected") return "connect_instagram";
  return "connected";
}

function formatLastRead(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const now = new Date();
  const sameDay = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short" });
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", hour: "2-digit", minute: "2-digit" });
  if (sameDay.format(date) === sameDay.format(now)) return `lido hoje às ${time.format(date)}`;

  const day = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "long" });
  return `lido em ${day.format(date)}`;
}

function CheckIcon() {
  return (
    <span
      aria-hidden="true"
      className="grid h-4 w-4 shrink-0 place-items-center rounded-full bg-[var(--ds-color-success-soft)] text-[9px] font-bold text-[var(--ds-color-success)]"
    >
      ✓
    </span>
  );
}

export function ProfileNextStepField({
  state,
  lastReadAt,
  onUpgrade,
  onConnectInstagram,
  onDefineNorth,
}: {
  state: NextStepFieldState;
  /** Última sincronização do relatório — vira a prova de que a conexão está viva. */
  lastReadAt?: string | null;
  onUpgrade: (context?: PaywallContext) => void;
  onConnectInstagram: () => void;
  onDefineNorth: () => void;
}) {
  if (state === "none") return null;

  // Sem narrativa, a oferta do Pro não teria em que se apoiar: o Norte vem antes.
  if (state === "define_north") {
    return (
      <section className="ds-notebook-section">
        <span className="ds-notebook-label">Primeiro passo</span>
        <h2 className="mt-2 text-[1.375rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">
          Defina seu Norte para começar o mapa.
        </h2>
        <p className="ds-body mt-2">
          Conte para quem você cria e o que deseja provocar. A D2C transforma essa resposta no seu primeiro rascunho.
        </p>
        <button type="button" className="ds-button ds-button--primary mt-4" onClick={onDefineNorth}>
          Definir meu Norte
        </button>
      </section>
    );
  }

  if (state === "connected") {
    const lastRead = formatLastRead(lastReadAt);
    // Sem peso de card: o que era pedido virou confirmação, e confirmação não
    // disputa atenção com a narrativa logo acima.
    return (
      <p className="flex items-center gap-2 px-1 pb-1 pt-3 text-[11.5px] text-[var(--ds-color-text-muted)]">
        <CheckIcon />
        <span>Instagram conectado{lastRead ? ` · ${lastRead}` : ""}</span>
      </p>
    );
  }

  if (state === "billing") {
    return (
      <section id="pro-activation" className="ds-notebook-section">
        <span className="ds-notebook-label">Assinatura</span>
        <h2 className="mt-2 text-[1.375rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">
          Seu pagamento precisa ser atualizado.
        </h2>
        <p className="ds-body mt-2">
          Seu mapa continua seguro. O que para enquanto isso é o relatório da semana.
        </p>
        <button type="button" className="ds-button ds-button--primary mt-4" onClick={() => onUpgrade("narrative_map")}>
          Atualizar pagamento
        </button>
      </section>
    );
  }

  if (state === "subscribe") {
    return (
      <section id="pro-activation" className="ds-notebook-section">
        <span className="ds-notebook-label">Seu próximo passo</span>
        <h2 className="mt-2 text-[1.375rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">Ative o Pro</h2>
        <p className="ds-body mt-2">
          Seu mapa vira relatório, pautas e collabs toda semana. Por enquanto, o que aparece aqui embaixo é um exemplo.
        </p>
        <button type="button" className="ds-button ds-button--primary mt-4" onClick={() => onUpgrade("narrative_map")}>
          Ativar o Pro
        </button>
      </section>
    );
  }

  const reconnecting = state === "reconnect_instagram";
  return (
    <section id="pro-activation" className="ds-notebook-section">
      <span className="ds-notebook-label">Seu próximo passo</span>
      <h2 className="mt-2 text-[1.375rem] font-bold leading-[1.12] text-[var(--ds-color-ink)]">
        {reconnecting ? "Seu relatório parou de atualizar." : "Conecte seu Instagram."}
      </h2>
      <p className="ds-body mt-2">
        {reconnecting
          ? "A conexão com o Instagram caiu, o que acontece de tempos em tempos. Enquanto você não reconectar, o relatório fica parado nos posts que já entraram."
          : "É assim que o relatório aqui embaixo passa a mostrar os seus posts, e não um exemplo."}
      </p>
      <button type="button" className="ds-button ds-button--primary mt-4" onClick={onConnectInstagram}>
        {reconnecting ? "Reconectar Instagram" : "Conectar Instagram"}
      </button>
    </section>
  );
}
