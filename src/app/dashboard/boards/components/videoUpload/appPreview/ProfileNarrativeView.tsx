"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import type { IMapaData, LifeAssetGroupKey } from "@/app/models/MapaSeed";
import {
  applyMapSeedMutation,
  persistMapSeedMutation,
  type MapSeedSection,
} from "@/app/dashboard/boards/videoUpload/mapSeedMutationClient";

/**
 * A narrativa por inteiro — a tela que "Ver narrativa completa" abre.
 *
 * O Perfil mostra a frase e os assuntos que a leitura reconheceu; aqui a pessoa
 * vê as CAMADAS que sustentam a frase e pode mexer nelas. A ordem não é
 * arbitrária, é a cadeia de evidência do produto:
 *
 *   TERRITÓRIOS  — onde ela é legítima para falar (o domínio de vida)
 *   ASSUNTOS     — o que de fato aparece nos posts hoje
 *   ADJACÊNCIAS  — cabe na narrativa, ainda não virou post
 *   DA SUA VIDA  — cenários, objetos e pessoas que a leitura já reconhece
 *
 * Mexer aqui muda o que a leitura da semana compara na segunda seguinte, e a
 * tela diz isso no rodapé. É a razão de a edição não morar no card do Perfil:
 * um toque de passagem não deveria reescrever a régua da semana.
 */

interface ChipSectionSpec {
  section: MapSeedSection;
  title: string;
  subtitle: string;
  /** Adjacências ainda não são fato: contorno tracejado, como no resto da tela. */
  tentative?: boolean;
  /** Assets carregam o grupo escolhido à mão, para não pular de seção depois. */
  group?: LifeAssetGroupKey;
}

const SECTIONS: ChipSectionSpec[] = [
  { section: "territorios", title: "Territórios", subtitle: "Onde você é legítima para falar." },
  { section: "temas", title: "Assuntos", subtitle: "O que aparece nos seus posts hoje." },
  {
    section: "narrativas_adjacentes",
    title: "Adjacências",
    subtitle: "Cabe na narrativa, ainda não virou post.",
    tentative: true,
  },
  {
    section: "assets",
    title: "Da sua vida",
    subtitle: "Cenários, objetos e pessoas que a leitura já reconhece.",
    group: "vida",
  },
];

function BackIcon() {
  return (
    <span aria-hidden="true" className="text-[14px] text-[var(--ds-color-text-muted)]">
      ‹
    </span>
  );
}

function ChipSection({
  spec,
  items,
  onAdd,
  onRemove,
}: {
  spec: ChipSectionSpec;
  items: string[];
  onAdd: (value: string) => void;
  onRemove: (value: string) => void;
}) {
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState("");
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (adding) inputRef.current?.focus();
  }, [adding]);

  const commit = () => {
    const value = draft.trim();
    if (value) onAdd(value);
    setDraft("");
    setAdding(false);
  };

  return (
    <section
      aria-labelledby={`narrative-section-${spec.section}`}
      className={`col-span-2 rounded-[16px] border p-5 ${
        spec.tentative
          ? "border-[var(--ds-color-line)] bg-[var(--ds-color-neutral)]"
          : "border-[var(--ds-color-line)] bg-[var(--ds-color-surface)]"
      }`}
    >
      <h2
        id={`narrative-section-${spec.section}`}
        className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]"
      >
        {spec.title}
      </h2>
      <p className="mt-1.5 text-[11.5px] leading-[1.4] text-[var(--ds-color-text-muted)]">{spec.subtitle}</p>

      <div className="mt-3.5 flex flex-wrap gap-[7px]">
        {items.map((item) => (
          <span
            key={item}
            className={`inline-flex items-center gap-[7px] rounded-full px-3 py-[7px] text-[12px] font-medium ${
              spec.tentative
                ? "border border-dashed border-[var(--ds-color-line-strong)] text-[var(--ds-color-text-secondary)]"
                : "border border-[var(--ds-color-line-strong)] text-[var(--ds-color-ink)]"
            }`}
          >
            {item}
            <button
              type="button"
              onClick={() => onRemove(item)}
              aria-label={`Remover ${item}`}
              className="grid h-[15px] w-[15px] shrink-0 place-items-center rounded-full bg-[var(--ds-color-line)] text-[10px] font-medium text-[var(--ds-color-text-secondary)]"
            >
              ✕
            </button>
          </span>
        ))}

        {adding ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-[var(--ds-color-ink)] bg-[var(--ds-color-surface)] px-3 py-[7px]">
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  commit();
                }
                if (event.key === "Escape") {
                  setDraft("");
                  setAdding(false);
                }
              }}
              placeholder={`novo em ${spec.title.toLocaleLowerCase("pt-BR")}`}
              aria-label={`Adicionar em ${spec.title}`}
              className="w-[130px] border-none bg-transparent text-[12px] font-medium text-[var(--ds-color-ink)] outline-none"
            />
            <button
              type="button"
              onClick={commit}
              className="text-[12px] font-semibold text-[var(--ds-color-ink)]"
            >
              salvar
            </button>
            <button
              type="button"
              onClick={() => {
                setDraft("");
                setAdding(false);
              }}
              aria-label="Cancelar"
              className="text-[12px] font-medium text-[var(--ds-color-text-muted)]"
            >
              ✕
            </button>
          </span>
        ) : (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="inline-flex items-center gap-1.5 rounded-full border border-dashed border-[var(--ds-color-line-strong)] px-3 py-[7px] text-[12px] font-medium text-[var(--ds-color-text-secondary)]"
          >
            + adicionar
          </button>
        )}
      </div>
    </section>
  );
}

function listOf(mapa: IMapaData | null, section: MapSeedSection): string[] {
  const value = mapa?.[section as keyof IMapaData];
  return Array.isArray(value) ? (value as string[]).filter(Boolean) : [];
}

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

/**
 * "O que não aparece": os assuntos que a pessoa declarou e a leitura ainda não
 * encontrou em vídeo nenhum.
 *
 * É determinístico — nada de IA — e recupera uma informação que o Perfil perdeu
 * quando os chips do card passaram a ser só os assuntos observados: a distância
 * entre o que ela diz que fala e o que os posts mostram. Essa distância é o
 * assunto mais útil da tela, e some se ninguém a nomear.
 */
/**
 * Casa por PALAVRA INTEIRA, nunca por pedaço de palavra.
 *
 * O `includes` cru — herdado do card antigo do mapa — dá falso positivo em
 * silêncio: "Fé" está contido em "café", "A" está contido em qualquer coisa. O
 * resultado é a tela dizer que um assunto declarado já apareceu em vídeo quando
 * nunca apareceu, que é o erro mais caro possível aqui: some justamente a
 * lacuna que a seção existe para nomear.
 */
function containsPhrase(haystack: string, needle: string): boolean {
  if (!needle) return false;
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|\\s)${escaped}($|\\s)`).test(haystack);
}

export function subjectsNotSeen(declared: string[], observed: string[]): string[] {
  const seen = observed.map(normalize).filter(Boolean);
  return declared.filter((subject) => {
    const target = normalize(subject);
    if (!target) return false;
    return !seen.some((item) => containsPhrase(item, target) || containsPhrase(target, item));
  });
}

export function ProfileNarrativeView({
  mapa,
  narrative,
  observedSubjects,
  coverageLine,
  onClose,
  onMapaChange,
}: {
  mapa: IMapaData | null;
  narrative: string;
  /** Assuntos que a leitura reconheceu nos vídeos. */
  observedSubjects: string[];
  /** "Atualizada a partir de 23 posts lidos nos últimos 90 dias." */
  coverageLine: string | null;
  onClose: () => void;
  /** Devolve o mapa mutado para quem é dono do estado. */
  onMapaChange: (next: IMapaData | null) => void;
}) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const { overflow } = document.body.style;
    document.body.style.overflow = "hidden";
    panelRef.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab") return;
      const panel = panelRef.current;
      if (!panel) return;
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])',
      );
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (!first || !last) return;
      if (document.activeElement === panel) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      previouslyFocused?.focus?.();
    };
  }, [onClose]);

  const mutate = (
    section: MapSeedSection,
    op: "add" | "remove",
    value: string,
    group?: LifeAssetGroupKey,
  ) => {
    onMapaChange(applyMapSeedMutation(mapa, section, op, value, group));
    void persistMapSeedMutation(section, op, value, group);
  };

  const declaredSubjects = [...listOf(mapa, "temas"), ...listOf(mapa, "territorios")];
  const notSeen = subjectsNotSeen(declaredSubjects, observedSubjects);

  if (typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[300] overflow-auto bg-[var(--ds-color-paper)] px-4 pb-14 pt-7"
      role="dialog"
      aria-modal="true"
      aria-labelledby="narrative-view-title"
    >
      <div ref={panelRef} tabIndex={-1} className="mx-auto w-full max-w-[430px] outline-none">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex items-center gap-[7px] text-[12.5px] font-semibold text-[var(--ds-color-ink)]"
        >
          <BackIcon /> Perfil
        </button>

        <div className="mt-6">
          <p className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]">
            Sua narrativa
          </p>
          {narrative ? (
            <blockquote
              id="narrative-view-title"
              className="mt-3.5 text-[26px] font-bold leading-[1.2] tracking-[-0.04em] text-[var(--ds-color-ink)]"
            >
              “{narrative}”
            </blockquote>
          ) : (
            <p
              id="narrative-view-title"
              className="mt-3.5 text-[20px] font-semibold leading-[1.3] text-[var(--ds-color-text-secondary)]"
            >
              Sua narrativa ainda não foi escrita.
            </p>
          )}
          <p className="mt-3 text-[12.5px] leading-[1.5] text-[var(--ds-color-text-secondary)]">
            Montada com o que você respondeu no onboarding e ajustada a cada leitura dos seus posts. É esse fio que a
            leitura da semana usa para comparar.
          </p>
        </div>

        <div className="mt-[26px] grid grid-cols-2 gap-3">
          {SECTIONS.map((spec) => (
            <ChipSection
              key={spec.section}
              spec={spec}
              items={listOf(mapa, spec.section)}
              onAdd={(value) => mutate(spec.section, "add", value, spec.group)}
              onRemove={(value) => mutate(spec.section, "remove", value, spec.group)}
            />
          ))}

          {/* O que a pessoa declara e os posts não mostram. Card tracejado porque
              é lacuna, não dado confirmado. */}
          <section
            aria-labelledby="narrative-section-gap"
            className="col-span-2 rounded-[16px] border border-dashed border-[var(--ds-color-line-strong)] bg-[var(--ds-color-surface)] p-5"
          >
            <h2
              id="narrative-section-gap"
              className="text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]"
            >
              O que não aparece
            </h2>
            {notSeen.length > 0 ? (
              <>
                <p className="mt-2.5 text-[15px] font-semibold leading-[1.36] tracking-[-0.005em] text-[var(--ds-color-ink)]">
                  {notSeen.length === 1
                    ? `Você declarou ${notSeen[0]}, e nenhum vídeo lido falou disso ainda.`
                    : `Você declarou ${notSeen.slice(0, 3).join(", ")}${
                        // Cortar em três sem dizer que há mais faz a tela mentir
                        // por omissão: quem tem seis lacunas leria três.
                        notSeen.length > 3 ? ` e mais ${notSeen.length - 3}` : ""
                      }, e nenhum vídeo lido falou desses assuntos ainda.`}
                </p>
                <p className="mt-2 text-[12px] leading-[1.45] text-[var(--ds-color-text-muted)]">
                  Ou o assunto ainda não virou post, ou ele saiu da sua narrativa. As duas respostas são úteis.
                </p>
              </>
            ) : (
              <p className="mt-2.5 text-[15px] font-semibold leading-[1.36] text-[var(--ds-color-text-secondary)]">
                {observedSubjects.length > 0
                  ? "Tudo que você declarou já apareceu em vídeo."
                  : "Nenhum vídeo foi lido ainda, então não dá para dizer o que falta."}
              </p>
            )}
          </section>
        </div>

        <div className="mt-[30px] flex flex-col gap-2 border-t border-dashed border-[var(--ds-color-line-strong)] pt-[18px]">
          {coverageLine ? (
            <p className="text-[11.5px] leading-[1.5] text-[var(--ds-color-text-muted)]">{coverageLine}</p>
          ) : null}
          <p className="text-[11.5px] leading-[1.5] text-[var(--ds-color-text-muted)] opacity-80">
            Mudar a narrativa muda o que a leitura compara na próxima segunda.
          </p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
