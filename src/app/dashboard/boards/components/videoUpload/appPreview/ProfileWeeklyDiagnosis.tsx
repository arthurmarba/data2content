"use client";

import { useState, type ReactNode } from "react";

import {
  CLAUDE_NEW_CHAT_URL,
  D2C_MCP_URL,
  buildClaudeHandoffPrompt,
} from "@/app/lib/creatorWeeklyReport/claudeHandoff";
import type {
  CreatorWeeklyDiagnosisEntry,
  CreatorWeeklyDiagnosisView,
} from "@/app/lib/creatorWeeklyReport/types";

import { ProfileSectionHeader } from "./ProfileSectionHeader";

/**
 * O diagnóstico da semana — e a porta para o Claude, no mesmo card.
 *
 * Enxuto de propósito: manchete, um parágrafo com a evidência e a pergunta que
 * fica. O resto da conversa acontece no Claude, que é onde a D2C vai morar no
 * dia a dia; por isso o gancho não é rodapé, é o fim natural da leitura. Quem
 * ainda não conectou encontra o passo a passo ali mesmo, sem trocar de tela.
 *
 * O número não sai de cena: vai dentro do texto, com a amostra, e o
 * multiplicador em negrito — é o dado que decide. A linha de amostra no pé é
 * calculada, nunca escrita pelo modelo.
 *
 * Rótulos, pergunta e passos são `div`/`li`, não `p`: na Jornada,
 * `.j-workspace p` impõe 14px, cinza e margem própria. Só o parágrafo do texto
 * usa `p`, e ali o estilo da Jornada é o certo.
 */

const MULTIPLIER = /(\d+(?:,\d+)?×)/g;

/** Pergunta de reserva, para quando ainda não há diagnóstico a continuar. */
const FALLBACK_HANDOFF =
  "Olhe meus posts dos últimos 90 dias e meu mapa na Data2Content e me diga o que está funcionando e o que ainda está em aberto. Diga o período e quantos posts analisou; se faltar dado, diga que falta.";

const LABEL = "text-[10.5px] font-semibold uppercase tracking-[0.08em] text-[var(--ds-color-text-muted)]";

/** Negrito nos multiplicadores ("2,4×"): o resto do parágrafo segue no tom do texto. */
function withEmphasis(text: string): ReactNode[] {
  return text.split(MULTIPLIER).map((part, index) =>
    index % 2 === 1 ? (
      <b key={index} className="font-semibold text-[var(--ds-color-ink)]">
        {part}
      </b>
    ) : (
      part
    ),
  );
}

/** "segunda-feira, a partir das 12h", no fuso de quem lê a semana. */
export function formatDiagnosisDue(dueAt: string | null): string | null {
  if (!dueAt) return null;
  const date = new Date(dueAt);
  if (!Number.isFinite(date.getTime())) return null;
  const weekday = new Intl.DateTimeFormat("pt-BR", { weekday: "long", timeZone: "America/Sao_Paulo" }).format(date);
  const hour = new Intl.DateTimeFormat("pt-BR", { hour: "numeric", hourCycle: "h23", timeZone: "America/Sao_Paulo" }).format(date);
  return `${weekday}, a partir das ${Number.parseInt(hour, 10)}h`;
}

/** A frase de espera, com o prazo dito: "se atualiza sozinho" não responde QUANDO. */
export function diagnosisStatusLine(view: CreatorWeeklyDiagnosisView): string | null {
  const week = view.upcomingRangeLabel ? `da semana de ${view.upcomingRangeLabel}` : "desta semana";
  switch (view.state) {
    case "ready":
      return null;
    case "waiting": {
      const due = formatDiagnosisDue(view.dueAt);
      return due ? `O diagnóstico ${week} sai ${due}.` : `O diagnóstico ${week} sai na segunda.`;
    }
    case "writing":
      return `O diagnóstico ${week} está sendo escrito. Aparece aqui em instantes.`;
    case "delayed":
      return `O diagnóstico ${week} atrasou. A leitura tenta de novo sozinha.`;
    case "missed":
      return `O diagnóstico ${week} não saiu. O próximo chega na segunda.`;
    case "unavailable":
      return `O diagnóstico ${view.shown ? "volta" : "começa"} quando houver pelo menos 3 posts nos últimos 90 dias para comparar.`;
  }
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

/**
 * O gancho. Conectado: um botão, e a pergunta vai copiada junto com o próprio
 * diagnóstico — a conversa começa de onde o Perfil parou. Sem conexão: os três
 * passos, uma vez só, e o mesmo botão no fim.
 *
 * O botão é um link, não `window.open` depois de copiar: o Safari bloqueia a
 * janela aberta fora do toque. A cópia começa no toque e o link abre sozinho.
 */
function ClaudeHandoff({
  prompt,
  connected,
  onOpenClaude,
  onCopyConnector,
}: {
  prompt: string;
  connected: boolean;
  onOpenClaude?: () => void;
  onCopyConnector?: () => void;
}) {
  const [status, setStatus] = useState("");

  const openClaude = () => {
    onOpenClaude?.();
    void copyText(prompt).then((ok) =>
      setStatus(ok ? "Pergunta copiada. No Claude, cole e envie." : "Não deu para copiar. No Claude, escreva a pergunta acima."),
    );
  };

  const copyAddress = () => {
    onCopyConnector?.();
    void copyText(D2C_MCP_URL).then((ok) =>
      setStatus(ok ? "Endereço copiado. Cole no Claude, em Adicionar conector personalizado." : "Não deu para copiar. Selecione o endereço e copie."),
    );
  };

  const button = (
    <a
      href={CLAUDE_NEW_CHAT_URL}
      target="_blank"
      rel="noreferrer"
      onClick={openClaude}
      className={`ds-button ds-button--primary ds-button--block justify-center gap-1.5 no-underline sm:max-w-[340px] ${connected ? "" : "mt-4"}`}
    >
      Continuar no Claude
      <span aria-hidden="true">↗</span>
    </a>
  );

  return (
    // Conectado, o botão vem direto depois da pergunta; o fio tracejado só separa
    // o passo a passo, que é outro assunto dentro do card.
    <div className={connected ? "mt-5" : "mt-5 border-t border-dashed border-[var(--ds-color-line-strong)] pt-4"}>
      {connected ? (
        button
      ) : (
        <>
          <div className="flex items-baseline justify-between gap-3">
            <div className={LABEL}>Continue no Claude</div>
            <div className="text-[11.5px] text-[var(--ds-color-text-muted)]">1 minuto, uma vez só</div>
          </div>
          <ol className="j-connect-steps mt-3" aria-label="Como conectar a Data2Content ao Claude">
            <li>
              <div>
                No Claude, abra <b>Personalizar → Conectores → + → Adicionar conector personalizado</b>.
              </div>
            </li>
            <li>
              <div>
                Dê o nome <b>Data2Content</b> e cole este endereço:
                <div className="j-connect-address mt-2">
                  <code>{D2C_MCP_URL}</code>
                  <button type="button" className="j-connect-copy" onClick={copyAddress}>
                    Copiar
                  </button>
                </div>
              </div>
            </li>
            <li>
              <div>Entre com sua conta D2C e autorize. Pronto: volte aqui e toque no botão.</div>
            </li>
          </ol>
          {button}
        </>
      )}
      <div role="status" aria-live="polite" className="mt-2 min-h-[1.2em] text-[12px] text-[var(--ds-color-text-secondary)]">
        {status}
      </div>
    </div>
  );
}

function DiagnosisCard({
  entry,
  connected,
  onOpenClaude,
  onCopyConnector,
}: {
  entry: CreatorWeeklyDiagnosisEntry;
  connected: boolean;
  onOpenClaude?: () => void;
  onCopyConnector?: () => void;
}) {
  return (
    <article
      aria-labelledby="weekly-diagnosis-headline"
      className="ds-card-stamp mt-3.5 rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-6"
    >
      <div className="flex items-center justify-between gap-3 text-[12px] text-[var(--ds-color-text-muted)]">
        <span>Semana de {entry.rangeLabel}</span>
        {connected ? (
          <span className="inline-flex items-center gap-1.5">
            <span aria-hidden="true" className="h-[7px] w-[7px] rounded-full bg-[#2f9e5b]" />
            Claude conectado
          </span>
        ) : null}
      </div>
      <h2
        id="weekly-diagnosis-headline"
        className="mt-2 text-[21px] font-semibold leading-[1.26] tracking-[-0.025em] text-[var(--ds-color-ink)]"
      >
        {entry.headline}
      </h2>

      {entry.paragraphs.map((paragraph, index) => (
        <p key={index} className="mt-3 text-[14px] leading-[1.55] text-[var(--ds-color-text-secondary)]">
          {withEmphasis(paragraph)}
        </p>
      ))}

      <div className="mt-4">
        <div className={LABEL}>A pergunta que fica</div>
        <div className="mt-1.5 text-[18px] font-semibold leading-[1.3] tracking-[-0.015em] text-[var(--ds-color-ink)]">
          {entry.question}
        </div>
      </div>

      <ClaudeHandoff
        prompt={buildClaudeHandoffPrompt(entry)}
        connected={connected}
        onOpenClaude={onOpenClaude}
        onCopyConnector={onCopyConnector}
      />

      <div className="text-[11.5px] leading-[1.5] text-[var(--ds-color-text-muted)]">{entry.sampleLine}</div>
    </article>
  );
}

export function ProfileWeeklyDiagnosis({
  view,
  isDemo,
  tag,
  claudeConnected = false,
  onOpenClaude,
  onCopyConnector,
}: {
  view: CreatorWeeklyDiagnosisView;
  isDemo: boolean;
  /** O estado da leitura: "Exemplo", "Leitura incompleta", "Pausado". */
  tag: string | null;
  /** Já existe conexão ativa da Data2Content no Claude desta pessoa. */
  claudeConnected?: boolean;
  onOpenClaude?: () => void;
  onCopyConnector?: () => void;
}) {
  const status = diagnosisStatusLine(view);
  return (
    <section
      id="weekly-report"
      aria-describedby={isDemo ? "weekly-report-demo-notice" : undefined}
      aria-live="polite"
    >
      <ProfileSectionHeader title="Diagnóstico da semana" tag={tag} level="first" />

      {isDemo ? (
        <div role="note" className="ds-notebook-note mt-3">
          <p id="weekly-report-demo-notice" className="m-0">
            <strong className="text-[var(--ds-color-ink)]">Este é um diagnóstico de exemplo.</strong>{" "}
            Com o Instagram conectado, toda segunda chega o dos seus posts.
          </p>
        </div>
      ) : null}

      {view.shown ? (
        <>
          <DiagnosisCard
            entry={view.shown}
            connected={claudeConnected}
            onOpenClaude={onOpenClaude}
            onCopyConnector={onCopyConnector}
          />
          {status ? (
            <div className="mt-3 text-[12.5px] leading-[1.5] text-[var(--ds-color-text-secondary)]">{status}</div>
          ) : null}
        </>
      ) : (
        <article className="ds-card-stamp mt-3.5 rounded-[16px] border border-[var(--ds-color-line)] bg-[var(--ds-color-surface)] p-6">
          <h2 className="text-[19px] font-semibold leading-[1.26] tracking-[-0.025em] text-[var(--ds-color-ink)]">
            {view.state === "unavailable" ? "Ainda sem posts para comparar." : "Seu diagnóstico está a caminho."}
          </h2>
          {status ? (
            <div className="mt-2.5 text-[13px] leading-[1.5] text-[var(--ds-color-text-secondary)]">{status}</div>
          ) : null}
          <ClaudeHandoff
            prompt={FALLBACK_HANDOFF}
            connected={claudeConnected}
            onOpenClaude={onOpenClaude}
            onCopyConnector={onCopyConnector}
          />
        </article>
      )}
    </section>
  );
}
