import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export interface ProposalReceivedEmailParams {
  creatorName?: string | null;
  creatorHandle?: string | null;
  brandName: string;
  contactName?: string | null;
  campaignTitle?: string | null;
  budgetText?: string | null;
  deliverables?: string[] | null;
  briefing?: string | null;
  createdAt?: Date | string | null;
  proposalUrl: string;
}

function normalizeHandle(handle?: string | null): string | null {
  if (!handle) return null;
  const trimmed = handle.trim();
  if (!trimmed) return null;
  return trimmed.startsWith('@') ? trimmed : `@${trimmed}`;
}

function formatDateTime(value?: Date | string | null): string | null {
  if (!value) return null;
  try {
    const resolved = value instanceof Date ? value : new Date(value);
    return format(resolved, "dd 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR });
  } catch {
    return null;
  }
}

export function proposalReceivedEmail(params: ProposalReceivedEmailParams) {
  const {
    creatorName,
    creatorHandle,
    brandName,
    contactName,
    campaignTitle,
    budgetText,
    deliverables = [],
    briefing,
    createdAt,
    proposalUrl,
  } = params;

  const greetingName = creatorName?.trim() || 'criador';
  const normalizedHandle = normalizeHandle(creatorHandle);
  const formattedDate = formatDateTime(createdAt);
  const deliverablesList = (deliverables || []).filter(Boolean);
  const hasBudget = typeof budgetText === 'string' && budgetText.trim().length > 0;
  const hasBriefing = typeof briefing === 'string' && briefing.trim().length > 0;

  const textLines = [
    `Oi ${greetingName},`,
    '',
    `Você recebeu uma nova proposta da marca ${brandName}${campaignTitle ? ` para a campanha "${campaignTitle}"` : ''}${hasBudget ? `, com orçamento de ${budgetText}.` : '.'}`,
  ];
  if (hasBriefing) {
    textLines.push('', `Briefing: ${briefing!.trim()}`);
  }
  textLines.push('', 'Resumo da proposta:');
  textLines.push(`- Marca: ${brandName}`);
  if (campaignTitle) textLines.push(`- Campanha: ${campaignTitle}`);
  if (contactName) textLines.push(`- Responsável: ${contactName}`);
  if (hasBudget) textLines.push(`- Orçamento: ${budgetText}`);
  if (deliverablesList.length) textLines.push(`- Entregáveis: ${deliverablesList.join(', ')}`);
  if (formattedDate) textLines.push(`- Recebida em: ${formattedDate}`);
  if (normalizedHandle) textLines.push(`- Link compartilhado: ${normalizedHandle}`);
  textLines.push('', 'Para ver todos os detalhes e responder à marca, acesse:');
  textLines.push(proposalUrl);
  textLines.push('', '— Equipe Data2Content');

  const text = textLines.join('\n');

  const summaryHtmlItems: string[] = [];
  summaryHtmlItems.push(`<li><strong>Marca:</strong> ${brandName}</li>`);
  if (campaignTitle) summaryHtmlItems.push(`<li><strong>Campanha:</strong> ${campaignTitle}</li>`);
  if (contactName) summaryHtmlItems.push(`<li><strong>Responsável:</strong> ${contactName}</li>`);
  if (hasBudget) summaryHtmlItems.push(`<li><strong>Orçamento:</strong> ${budgetText}</li>`);
  if (deliverablesList.length) {
    const listItems = deliverablesList.map((item) => `<li>${item}</li>`).join('');
    summaryHtmlItems.push(`<li><strong>Entregáveis desejados:</strong><ul style="margin-top:4px;padding-left:18px;">${listItems}</ul></li>`);
  }
  if (formattedDate) summaryHtmlItems.push(`<li><strong>Recebida em:</strong> ${formattedDate}</li>`);
  if (normalizedHandle) summaryHtmlItems.push(`<li><strong>Mídia Kit:</strong> ${normalizedHandle}</li>`);

  const htmlBriefing = hasBriefing
    ? `<div style="margin:24px 0;padding:16px;border-radius:12px;background:#fdf2f8;border:1px solid #fbcfe8;">
        <p style="margin:0 0 8px;font-weight:600;color:#831843;">Briefing da marca</p>
        <p style="margin:0;white-space:pre-wrap;color:#4c0519;">${briefing!.trim().replace(/\n/g, '<br/>')}</p>
      </div>`
    : '';

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2933;">
      <p style="margin:0 0 16px;">Oi ${greetingName},</p>
      <p style="margin:0 0 16px;">
        Você recebeu uma nova proposta da marca <strong>${brandName}</strong>
        ${campaignTitle ? ` para a campanha "<strong>${campaignTitle}</strong>"` : ''}
        ${hasBudget ? `, com orçamento de <strong>${budgetText}</strong>.` : '.'}
      </p>
      ${htmlBriefing}
      <div style="margin:24px 0;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <p style="margin:0 0 12px;font-weight:600;color:#0f172a;">Resumo da proposta</p>
        <ul style="margin:0;padding-left:20px;color:#334155;">
          ${summaryHtmlItems.join('')}
        </ul>
      </div>
      <div style="margin:24px 0;">
        <a
          href="${proposalUrl}"
          style="display:inline-block;padding:12px 24px;border-radius:999px;background:#6E1F93;color:#ffffff;text-decoration:none;font-weight:600;"
        >
          Ver proposta na plataforma
        </a>
      </div>
      <p style="margin:24px 0 0;color:#475569;font-size:14px;">— Equipe Data2Content</p>
    </div>
  `;

  return {
    subject: 'Nova proposta recebida no seu Mídia Kit 🎯',
    text,
    html,
  };
}
