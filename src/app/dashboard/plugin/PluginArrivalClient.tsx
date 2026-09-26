"use client";

import Link from "next/link";
import { track } from "@/lib/track";
import { openPaywallModal } from "@/utils/paywallModal";
import type { PluginArrivalData } from "@/app/lib/plugin/arrival";
import {
  PLUGIN_CLIENT_LABEL,
  pluginFunnelEventName,
  pluginPaywallContext,
  pluginReadyPath,
  type PluginClient,
  type PluginIntent,
} from "@/app/lib/plugin/pluginClient";
import { PluginFunnelTracker } from "./PluginFunnelTracker";

// O que o Pro faz, na ordem em que importa para quem pediu cada coisa no chat.
const PRO_BENEFITS: Record<Exclude<PluginIntent, "mapa">, string> = {
  pautas: "Pautas novas toda semana, ancoradas nos seus territórios",
  analise: "A leitura dos seus posts: o que funciona para você, medido contra a sua própria mediana",
  inspiracoes: "Referências de criadores da comunidade que foram acima da própria média",
  collabs: "Collabs com criadores que dividem território com você, com pauta para gravarem juntos",
  roteiro: "Roteiros escritos a partir dos seus vídeos que funcionaram",
};
const BENEFIT_ORDER: Array<Exclude<PluginIntent, "mapa">> = ["pautas", "analise", "collabs", "roteiro", "inspiracoes"];

const INTENT_EXPLANATION: Record<Exclude<PluginIntent, "mapa" | "pautas">, { title: string; body: string }> = {
  analise: {
    title: "A análise dos seus posts",
    body:
      "Com o Instagram conectado, a Data2Content lê assunto, gancho, cenário, voz, duração e horário de cada post e mostra o que funciona para você — sempre comparado com a sua própria mediana, nunca com outro criador.",
  },
  inspiracoes: {
    title: "Referências da comunidade",
    body:
      "Pesquise posts de outros criadores da comunidade que foram acima da própria média, com o gancho, o cenário e a duração de cada um, para adaptar à sua voz.",
  },
  collabs: {
    title: "Collabs",
    body:
      "A Data2Content encontra criadores que dividem território com você e propõe uma pauta para vocês gravarem juntos.",
  },
  roteiro: {
    title: "Roteiros com os seus vídeos",
    body:
      "Os roteiros saem da sua fala e dos seus vídeos que funcionaram, e são revisados contra o seu próprio histórico.",
  },
};

function orderedBenefits(intent: PluginIntent | null): string[] {
  const first = intent && intent !== "mapa" ? [intent] : [];
  const rest = BENEFIT_ORDER.filter((item) => item !== intent);
  return [...first, ...rest].slice(0, 4).map((item) => PRO_BENEFITS[item]);
}

export function PluginArrivalClient({
  client,
  intent,
  data,
  returnUrl,
}: {
  client: PluginClient;
  intent: PluginIntent | null;
  data: PluginArrivalData;
  returnUrl: string | null;
}) {
  const label = PLUGIN_CLIENT_LABEL[client];
  const explanation = intent && intent !== "mapa" && intent !== "pautas" ? INTENT_EXPLANATION[intent] : null;

  const openPlans = () => {
    track(pluginFunnelEventName(client), {
      creator_id: null,
      step: "profile_upgrade_clicked",
      source: `${client}_arrival`,
      context: pluginPaywallContext(client),
      status: intent,
      event_id: null,
    });
    openPaywallModal({
      context: pluginPaywallContext(client),
      source: `${client}_profile_upgrade`,
      // Depois de assinar, a tela de "continue no chat"; a análise pede o Instagram antes.
      returnTo: pluginReadyPath(client),
      postCheckoutIntent: (intent === "analise" || intent === "roteiro") && !data.instagramConnected
        ? "connect_instagram"
        : null,
    });
  };

  return (
    <main className="min-h-[100dvh] bg-white px-4 pb-16 pt-8 text-[#171717] sm:px-6">
      <PluginFunnelTracker client={client} step="offer_viewed" context={pluginPaywallContext(client)} intent={intent} />
      <div className="mx-auto flex w-full max-w-xl flex-col gap-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-black/45">Data2Content + {label}</p>

        <section className="rounded-3xl bg-[#f5f5f4] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Sua narrativa</p>
          {data.narrative ? (
            <>
              <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight">{data.narrative}</h1>
              {data.territories.length ? (
                <ul className="mt-4 flex flex-wrap gap-2" aria-label="Territórios">
                  {data.territories.map((territory) => (
                    <li key={territory} className="rounded-full border border-[#3d3d3d] px-3 py-1 text-xs font-semibold">
                      {territory}
                    </li>
                  ))}
                </ul>
              ) : null}
              {!data.narrativeIsFirm ? (
                <p className="mt-4 text-sm leading-6 text-black/55">
                  Primeira leitura, a partir do que você contou. Ela se afina conforme a Data2Content lê seus conteúdos.
                </p>
              ) : null}
            </>
          ) : (
            <>
              <h1 className="mt-3 text-2xl font-black leading-tight tracking-tight">Seu mapa ainda está se formando</h1>
              <p className="mt-3 text-sm leading-6 text-black/55">
                Volte ao {label} e conte quem você é como criador e o que quer provocar em quem te acompanha. A narrativa nasce daí.
              </p>
            </>
          )}
        </section>

        {explanation ? (
          <section className="rounded-3xl bg-[#f5f5f4] p-6">
            <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">O que você pediu</p>
            <h2 className="mt-3 text-lg font-black tracking-tight">{explanation.title}</h2>
            <p className="mt-2 text-sm leading-6 text-black/60">{explanation.body}</p>
            <p className="mt-3 text-sm font-semibold">Isso faz parte do plano Pro.</p>
          </section>
        ) : null}

        <section className="rounded-3xl bg-[#f5f5f4] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Suas pautas</p>
          {data.ideas.length ? (
            <ul className="mt-4 flex flex-col divide-y divide-[#e8e8e8]">
              {data.ideas.map((idea) => (
                <li key={idea.id} className="py-3 first:pt-0 last:pb-0">
                  <p className="text-base font-bold leading-snug">{idea.title}</p>
                  {idea.hook ? <p className="mt-1 text-sm leading-6 text-black/60">“{idea.hook}”</p> : null}
                  {idea.territory ? (
                    <span className="mt-2 inline-block rounded-full border border-[#3d3d3d] px-2.5 py-0.5 text-[11px] font-semibold">
                      {idea.territory}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : data.ideasState === "preparing" ? (
            <p className="mt-3 text-sm leading-6 text-black/60">
              Suas primeiras pautas estão sendo preparadas a partir da sua narrativa. Leva cerca de um minuto.{" "}
              <button
                type="button"
                className="font-semibold text-black underline underline-offset-2"
                onClick={() => window.location.reload()}
              >
                Atualizar
              </button>
            </p>
          ) : data.ideasState === "waiting_map" ? (
            <p className="mt-3 text-sm leading-6 text-black/60">
              As pautas nascem da sua narrativa e dos seus territórios. Assim que o mapa tiver os dois, elas aparecem aqui.
            </p>
          ) : (
            <p className="mt-3 text-sm leading-6 text-black/60">
              Não conseguimos preparar suas pautas agora. Elas continuam disponíveis no seu mapa assim que estiverem prontas.
            </p>
          )}
        </section>

        <section className="rounded-3xl bg-[#f5f5f4] p-6">
          <p className="text-xs font-bold uppercase tracking-[0.14em] text-black/45">Plano Pro</p>
          <h2 className="mt-3 text-lg font-black tracking-tight">O que o Pro faz com a sua narrativa</h2>
          <ul className="mt-4 flex flex-col gap-3">
            {orderedBenefits(intent).map((benefit) => (
              <li key={benefit} className="flex gap-3 text-sm leading-6">
                <span aria-hidden className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-[#171717]" />
                <span>{benefit}</span>
              </li>
            ))}
          </ul>
          <button
            type="button"
            onClick={openPlans}
            className="mt-6 inline-flex min-h-12 w-full items-center justify-center rounded-full bg-[#171717] px-6 text-sm font-bold text-white transition hover:bg-black"
          >
            Ver planos
          </button>
          <div className="mt-4 flex flex-col items-center gap-2 text-sm">
            <Link href="/dashboard/profile" className="font-semibold text-black/65 underline-offset-2 hover:underline">
              Ver meu mapa primeiro
            </Link>
            {returnUrl ? (
              <a
                href={returnUrl}
                className="font-semibold text-black/65 underline-offset-2 hover:underline"
                onClick={() => {
                  track(pluginFunnelEventName(client), {
                    creator_id: null,
                    step: client === "claude" ? "return_to_claude_clicked" : "return_to_chatgpt_clicked",
                    source: `${client}_arrival`,
                    context: pluginPaywallContext(client),
                    status: intent,
                    event_id: null,
                  });
                }}
              >
                Voltar ao {label}
              </a>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}
