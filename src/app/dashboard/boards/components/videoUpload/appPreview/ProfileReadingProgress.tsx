"use client";

import { profileProgressMessage, type ProfileEvolution } from '@/app/lib/creatorWeeklyReport/evolution';

function dateLabel(value: string | null) {
  return value ? new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(new Date(value)) : 'data indisponível';
}

export function ProfileReadingProgress({ evolution }: { evolution: ProfileEvolution | undefined }) {
  if (!evolution) return <p className="ds-caption mt-3" role="status">A data da análise de conteúdo ainda não está disponível.</p>;
  return (
    <section className="ds-notebook-note mt-4" aria-label="Atualização do perfil">
      <p className="ds-body m-0" role="status">{profileProgressMessage(evolution)}</p>
      <details className="mt-2 text-[12px] text-[var(--ds-color-text-secondary)]">
        <summary className="cursor-pointer">Ver datas e cobertura</summary>
        <p>Métricas sincronizadas: {dateLabel(evolution.metricsSyncedAt)}{evolution.metricsPartial ? ' · atualização parcial' : ''}.</p>
        <p>Última análise de conteúdo: {dateLabel(evolution.lastAnalyzedAt)}.</p>
        <p>Mapa revisado: {dateLabel(evolution.mapReviewedAt)}.</p>
        {([['week', 'Semana fechada'], ['recent', 'Últimos 28 dias'], ['history', 'Últimos 90 dias']] as const).map(([key, label]) => {
          const coverage = evolution.windows[key];
          return <p key={key}>{label}: {coverage.analyzed} de {coverage.eligible} posts lidos · {coverage.pending} pendentes{coverage.unsupported > 0 ? ` · ${coverage.unsupported} não puderam ser lidos` : ''}. Abertura falada: {coverage.openings.identified} identificadas em {coverage.openings.eligible} vídeos{coverage.openings.notApplicable > 0 ? ` · ${coverage.openings.notApplicable} posts sem aplicação de fala` : ''}.</p>;
        })}
      </details>
      {evolution.subjects.some(subject => subject.recent) ? <p className="ds-caption mt-2">Apareceu recentemente: {evolution.subjects.filter(subject => subject.recent).map(subject => subject.label).join(' · ')}.</p> : null}
      {evolution.subjects.length > 0 ? <details className="mt-3 text-[12px]">
        <summary className="cursor-pointer">Assuntos reconhecidos · últimos 28 dias</summary>
        {evolution.subjects.map(subject => <div key={subject.label} className="mt-2">
          <p>{subject.label} · {subject.postIds.length} {subject.postIds.length === 1 ? 'post' : 'posts'} · última ocorrência em {dateLabel(subject.lastSeenAt)}.</p>
          {subject.evidence?.filter(ref => ref.postLink).slice(-3).map((ref, index) => <a key={ref.postId} href={ref.postLink!} target="_blank" rel="noreferrer" className="mr-3 underline">Ver post {index + 1}</a>)}
        </div>)}
      </details> : null}
      {evolution.recentOpenings.length > 0 ? (
        <details className="mt-3 text-[13px]">
          <summary className="cursor-pointer font-semibold">Aberturas recentes · últimos 28 dias</summary>
          <p className="ds-caption mt-2">Exemplos novos incorporados à leitura. O melhor exemplo dos 90 dias continua nos padrões abaixo.</p>
          <p className="ds-caption mt-2">Estes exemplos mostram o que foi identificado. Sozinhos, não demonstram melhora em relação ao período anterior.</p>
          {evolution.openingComparison?.available ? <div className="ds-caption mt-2">
            <p>Jeitos de começar: frequência nos últimos 28 dias e nos 28 anteriores. Agrupamento descritivo; não é uma comparação de desempenho.</p>
            {evolution.openingComparison.mechanisms.map(item => <p key={item.label}>{item.label}: {item.recent} de {evolution.openingComparison!.recentPosts} agora; {item.previous} de {evolution.openingComparison!.previousPosts} antes.</p>)}
          </div> : <p className="ds-caption mt-2">Ainda falta cobertura equivalente para comparar os jeitos de começar com os 28 dias anteriores.</p>}
          {evolution.recentOpenings.map(opening => (
            <p key={opening.postId} className="mt-3">
              <span className="ds-caption">{dateLabel(opening.publishedAt)} · {opening.source === 'speech' ? 'fala' : 'título visual'}</span><br />
              {opening.postLink ? <a className="underline" href={opening.postLink} target="_blank" rel="noreferrer">“{opening.text}”</a> : <>“{opening.text}”</>}
            </p>
          ))}
        </details>
      ) : null}
    </section>
  );
}
