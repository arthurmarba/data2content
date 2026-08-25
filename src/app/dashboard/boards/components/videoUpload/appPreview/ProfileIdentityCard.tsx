"use client";

import { useState, type ReactNode } from "react";

/**
 * A abertura do Perfil: quem é a pessoa e qual é o fio dela, num card só.
 *
 * Antes eram dois blocos — retrato e nome soltos no canvas, e "Seu mapa" como
 * seção separada logo abaixo. Separados, eles diziam duas coisas quando o
 * assunto é um: a narrativa É a identidade aqui, não um dado sobre ela. Junto no
 * mesmo card, o nome e o fio se leem de uma vez, e a linha tracejada entre os
 * dois marca que o de baixo é consequência do de cima.
 *
 * Os chips embaixo são os assuntos que a leitura reconhece hoje. Eles não são
 * editáveis daqui: mexer no mapa muda o que a leitura compara na semana
 * seguinte, e isso pede a tela cheia da narrativa, não um toque de passagem.
 */

function ProfileAvatar({ name, imageUrl }: { name: string | null; imageUrl: string | null }) {
  const [failed, setFailed] = useState(false);
  const initial = (name?.trim().split(/\s+/)[0] || "C").charAt(0).toUpperCase();
  return (
    <div className="ds-profile-avatar grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--ds-color-line)] bg-[var(--ds-color-neutral)] text-[24px] font-extrabold text-[var(--ds-color-ink)]">
      {imageUrl && !failed ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={imageUrl} alt="" className="h-full w-full object-cover" onError={() => setFailed(true)} />
      ) : (
        initial
      )}
    </div>
  );
}

export function ProfileIdentityCard({
  userName,
  userImageUrl,
  headerSubtitle,
  narrative,
  narrativeIsPlaceholder,
  subjects,
  onOpenFullMap,
  onDefineNarrative,
  starterMapJustCreated,
  statusLine,
}: {
  userName: string | null;
  userImageUrl: string | null;
  headerSubtitle: string;
  narrative: string;
  narrativeIsPlaceholder: boolean;
  subjects: string[];
  onOpenFullMap: () => void;
  onDefineNarrative: () => void;
  starterMapJustCreated: boolean;
  /** "✓ Instagram conectado · lido hoje às 11h" — confirmação, não card. */
  statusLine?: ReactNode;
}) {
  return (
    <section
      id="creator-weekly-map"
      aria-labelledby="creator-map-title"
      className={`ds-card-stamp col-span-2 rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-6 transition-shadow duration-700 ${
        starterMapJustCreated
          ? "ring-2 ring-[var(--ds-color-brand)] ring-offset-4 ring-offset-[var(--ds-color-paper)]"
          : ""
      }`}
    >
      <div className="ds-profile-identity flex items-center gap-[17px]">
        <ProfileAvatar name={userName} imageUrl={userImageUrl} />
        <div className="min-w-0 flex-1">
          <h1 className="ds-profile-title truncate text-[24px] font-bold leading-[1.06] tracking-[-0.035em] text-[var(--ds-color-ink)]">
            {userName || "Seu perfil"}
          </h1>
          <p className="mt-[5px] truncate text-[12px] text-[var(--ds-color-text-muted)]">{headerSubtitle}</p>
        </div>
      </div>

      <div className="mt-[26px] border-t border-dashed border-[var(--ds-color-line-strong)] pt-6">
        <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
          Sua narrativa
        </p>

        {narrativeIsPlaceholder ? (
          <>
            <p
              id="creator-map-title"
              className="mt-2.5 text-[19px] font-semibold leading-[1.3] tracking-[-0.025em] text-[var(--ds-color-ink)]"
            >
              Defina sua narrativa para o D2C começar a ler seus posts.
            </p>
            <p className="mt-2.5 text-[12.5px] leading-[1.45] text-[var(--ds-color-text-secondary)]">
              Conte para quem você cria e o que quer provocar nessas pessoas. É dessa resposta que sai o fio que a
              leitura usa para comparar.
            </p>
            <button
              type="button"
              onClick={onDefineNarrative}
              className="ds-button ds-button--primary ds-button--block mt-3.5"
            >
              Definir minha narrativa
            </button>
          </>
        ) : (
          <>
            <blockquote
              id="creator-map-title"
              className="mt-3.5 text-[19px] font-semibold leading-[1.34] tracking-[-0.025em] text-[var(--ds-color-ink)]"
            >
              “{narrative}”
            </blockquote>

            {subjects.length > 0 ? (
              <div className="mt-[18px] flex flex-wrap gap-[7px]">
                {subjects.map((subject) => (
                  <span
                    key={subject}
                    className="rounded-full border border-[var(--ds-color-line)] px-[11px] py-[5px] text-[11.5px] text-[var(--ds-color-text-muted)]"
                  >
                    {subject}
                  </span>
                ))}
              </div>
            ) : null}

            <div className="mt-[22px] flex justify-end">
              <button
                type="button"
                onClick={onOpenFullMap}
                className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ds-color-ink)]"
              >
                Ver narrativa completa
                <span aria-hidden="true" className="text-[13px] text-[var(--ds-color-text-muted)]">
                  ›
                </span>
              </button>
            </div>
          </>
        )}

        {statusLine}
      </div>
    </section>
  );
}

/**
 * Mídia Kit e calculadora, lado a lado logo abaixo da identidade.
 *
 * São as duas portas de trabalho: quando uma marca chama, é aqui que a pessoa
 * vai — e marca chama a qualquer hora, então isso não é assunto de rodapé. Cada
 * card mostra o ESTADO ("Pronto", "R$ 2.400"), não só o nome: um botão que não
 * diz nada obriga a abrir para descobrir se há algo lá dentro.
 */
export function ProfileToolCards({
  isPro,
  calculatorPrice,
  mediaKitReady,
  mediaKitNote,
  onOpenMediaKit,
  onOpenCalculator,
}: {
  isPro: boolean;
  calculatorPrice: string | null;
  mediaKitReady: boolean;
  mediaKitNote: string | null;
  onOpenMediaKit: () => void;
  onOpenCalculator: () => void;
}) {
  const cards = [
    {
      id: "media-kit",
      label: "Mídia Kit",
      value: mediaKitReady ? "Pronto" : "—",
      note: mediaKitReady ? mediaKitNote ?? "sua página para marcas" : "monte o seu",
      action: onOpenMediaKit,
    },
    {
      id: "calculator",
      label: "Calculadora",
      value: isPro && calculatorPrice ? calculatorPrice : "—",
      note: isPro && calculatorPrice ? "último cálculo" : "calcule seu preço justo",
      action: onOpenCalculator,
    },
  ];

  return (
    <>
      {cards.map((card) => (
        <button
          key={card.id}
          type="button"
          onClick={card.action}
          className="ds-card-stamp ds-card-lift rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-5 text-left"
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
              {card.label}
            </span>
            <span aria-hidden="true" className="text-[13px] font-semibold text-[var(--ds-color-text-muted)]">
              ›
            </span>
          </span>
          <span className="mt-3.5 block text-[20px] font-bold leading-[1.1] tracking-[-0.035em] text-[var(--ds-color-ink)]">
            {card.value}
          </span>
          <span className="mt-1.5 block text-[11.5px] leading-[1.3] text-[var(--ds-color-text-muted)]">
            {card.note}
          </span>
        </button>
      ))}
    </>
  );
}
