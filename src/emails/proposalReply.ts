import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ProposalReplyEmailParams {
  creatorName?: string | null;
  creatorHandle?: string | null;
  brandName: string;
  campaignTitle?: string | null;
  emailBody: string;
  budgetText?: string | null;
  deliverables?: string[];
  receivedAt?: Date | null;
  mediaKitUrl?: string | null;
}

function formatDate(value?: Date | null): string | null {
  if (!value) return null;
  try {
    return format(value, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return value.toISOString();
  }
}

function buildHtmlParagraphs(text: string): string {
  return text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map(
      (paragraph) =>
        `<p style="margin:0 0 16px;line-height:1.5;color:#1f2933;">${paragraph
          .split('\n')
          .map((line) => line.trim())
          .filter(Boolean)
          .join('<br/>')}</p>`
    )
    .join('');
}

export function proposalReplyEmail(params: ProposalReplyEmailParams) {
  const {
    creatorName,
    creatorHandle,
    brandName,
    campaignTitle,
    emailBody,
    budgetText,
    deliverables = [],
    receivedAt,
    mediaKitUrl,
  } = params;

  const safeBody = emailBody.trim();
  const formattedDate = formatDate(receivedAt);
  const summaryLines = [
    `Marca: ${brandName}`,
    campaignTitle ? `Campanha: ${campaignTitle}` : null,
    budgetText ? `Orçamento: ${budgetText}` : null,
    deliverables.length ? `Entregáveis: ${deliverables.join(', ')}` : null,
    formattedDate ? `Proposta recebida em: ${formattedDate}` : null,
    mediaKitUrl ? `Mídia kit: ${mediaKitUrl}` : null,
  ]
    .filter(Boolean)
    .join('\n');

  const subjectPrefix = campaignTitle ? `Campanha "${campaignTitle}"` : `Proposta ${brandName}`;
  const subject = `${subjectPrefix} — resposta do ${creatorName ?? 'criador'}`;

  const normalizedHandle =
    creatorHandle && creatorHandle.trim().length > 0
      ? creatorHandle.trim().startsWith('@')
        ? creatorHandle.trim()
        : `@${creatorHandle.trim()}`
      : null;
  const bodyHasSignature = /\bvia Data2Content\b/i.test(safeBody);
  const signatureLines =
    bodyHasSignature
      ? null
      : [
          creatorName ?? 'Seu nome',
          normalizedHandle ? `${normalizedHandle} | via Data2Content` : 'via Data2Content',
          'https://data2content.ai',
        ].join('\n');

  const textSegments = [safeBody, '', 'Resumo da proposta:', summaryLines];
  if (signatureLines) {
    textSegments.push('', signatureLines);
  }
  const text = textSegments.join('\n');

  const html = `
  <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2933;">
    ${buildHtmlParagraphs(safeBody)}
    <div style="margin:24px 0;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
      <p style="margin:0 0 8px;font-weight:600;color:#0f172a;">Resumo da proposta</p>
      <ul style="margin:0;padding-left:20px;color:#334155;">
        ${summaryLines
          .split('\n')
          .map((line) => `<li style="margin-bottom:4px;">${line}</li>`)
          .join('')}
      </ul>
    </div>
    ${
      signatureLines
        ? `<div style="margin-top:32px;border-top:1px solid #e2e8f0;padding-top:16px;color:#475569;font-size:13px;">
      ${signatureLines
        .split('\n')
        .map((line) => `<div>${line}</div>`)
        .join('')}
    </div>`
        : ''
    }
  </div>
  `;

  return { subject, text, html };
}
