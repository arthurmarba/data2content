"use client";

/**
 * Cabeçalho de seção do Perfil: rótulo curto seguido de um fio até a margem.
 *
 * Substitui a casca de cartão que envolvia cada seção — o fio separa os assuntos
 * sem cobrar padding, que numa tela de 375px é largura roubada de todo o conteúdo
 * de dentro. A tag da direita, quando existe, diz o estado daquela seção
 * ("Dados de exemplo", "Parado em 10 de agosto").
 */
export function ProfileSectionHeader({
  id,
  title,
  tag,
  className = "",
}: {
  id?: string;
  title: string;
  tag?: string | null;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
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
