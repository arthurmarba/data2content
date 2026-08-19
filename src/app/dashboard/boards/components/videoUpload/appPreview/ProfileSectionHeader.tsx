"use client";

/**
 * Cabeçalho de seção do Perfil: rótulo curto seguido de um fio até a margem.
 *
 * Substitui a casca de cartão que envolvia cada seção — o fio separa os assuntos
 * sem cobrar padding, que numa tela de 375px é largura roubada de todo o conteúdo
 * de dentro. A tag da direita, quando existe, diz o estado daquela seção
 * ("Dados de exemplo", "Parado em 10 de agosto").
 *
 * O ritmo vertical mora aqui, não nas chamadas: dois níveis, um valor cada.
 * Espalhado em `className` por call site, ele virava 26 num lugar, 22 no outro e
 * zero no terceiro — que é exatamente o que se lê como "sem padrão".
 */

const SPACING = {
  /** Assunto de primeiro nível: mapa, relatório, inspiração, reuniões. */
  section: "mt-[26px]",
  /** Divisão interna de um assunto: os grupos de padrões, o vídeo da semana. */
  group: "mt-[22px]",
  /** Abre a página — o respiro vem do padding do container. */
  first: "mt-0",
} as const;

export function ProfileSectionHeader({
  id,
  title,
  tag,
  level = "section",
}: {
  id?: string;
  title: string;
  tag?: string | null;
  level?: keyof typeof SPACING;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${SPACING[level]}`}>
      <span
        id={id}
        className="text-[10.5px] font-semibold uppercase tracking-[0.09em] text-[var(--ds-color-text-muted)]"
      >
        {title}
      </span>
      <span aria-hidden="true" className="h-px flex-1 bg-[var(--ds-color-line)]" />
      {tag ? (
        <span className="rounded-full border border-dashed border-[var(--ds-color-line-strong)] px-2.5 py-1 text-[10px] font-semibold text-[var(--ds-color-text-secondary)]">
          {tag}
        </span>
      ) : null}
    </div>
  );
}
