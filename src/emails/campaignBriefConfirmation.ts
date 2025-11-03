export interface CampaignBriefConfirmationParams {
  brandName: string;
  budgetText?: string | null;
  segments?: string[];
  description?: string | null;
  originHandle?: string | null;
}

function buildSegmentsList(segments?: string[]): string {
  if (!Array.isArray(segments) || segments.length === 0) {
    return '—';
  }
  return Array.from(new Set(segments.filter(Boolean)))
    .map((segment) => segment.trim())
    .filter(Boolean)
    .join(', ');
}

export function campaignBriefConfirmation(params: CampaignBriefConfirmationParams) {
  const { brandName, budgetText, segments = [], description, originHandle } = params;

  const segmentsText = buildSegmentsList(segments);
  const normalizedDescription = description?.trim();
  const referencedHandle =
    typeof originHandle === 'string' && originHandle.trim().length > 0
      ? originHandle.trim().startsWith('@')
        ? originHandle.trim()
        : `@${originHandle.trim()}`
      : null;

  const textLines = [
    `Oi ${brandName},`,
    '',
    'Recebemos o seu briefing de campanha! Obrigado por escolher a Data2Content para conectar sua marca aos criadores certos.',
    '',
    'Nas próximas horas nossa inteligência vai analisar os dados e sugerir os perfis ideais.',
    'Em seguida, nossa equipe entrará em contato com você pelo e-mail informado.',
    '',
    'Resumo do briefing:',
    `- Marca: ${brandName}`,
    `- Orçamento: ${budgetText ?? '—'}`,
    `- Segmentos: ${segmentsText}`,
  ];
  if (referencedHandle) {
    textLines.push(`- Mídia Kit de origem: ${referencedHandle}`);
  }
  if (normalizedDescription) {
    textLines.push('', 'Briefing:');
    textLines.push(normalizedDescription);
  }
  textLines.push('', 'Enquanto isso, você pode conhecer mais sobre nossos criadores em https://data2content.ai');
  textLines.push('', '— Equipe Data2Content');

  const text = textLines.join('\n');

  const html = `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;font-size:15px;line-height:1.6;color:#1f2933;">
      <p style="margin:0 0 16px;">Oi <strong>${brandName}</strong>,</p>
      <p style="margin:0 0 16px;">
        Recebemos o seu briefing de campanha! Obrigado por confiar na Data2Content para criar conexões inteligentes com criadores.
        Em breve nossa equipe entra em contato com a recomendação ideal para o seu objetivo.
      </p>
      <div style="margin:24px 0;padding:16px;border-radius:12px;background:#f8fafc;border:1px solid #e2e8f0;">
        <p style="margin:0 0 12px;font-weight:600;color:#0f172a;">Resumo do briefing</p>
        <ul style="margin:0;padding-left:20px;color:#334155;">
          <li><strong>Marca:</strong> ${brandName}</li>
          <li><strong>Orçamento:</strong> ${budgetText ?? '—'}</li>
          <li><strong>Segmentos:</strong> ${segmentsText || '—'}</li>
          ${referencedHandle ? `<li><strong>Mídia Kit de origem:</strong> ${referencedHandle}</li>` : ''}
        </ul>
      </div>
      ${
        normalizedDescription
          ? `<div style="margin:24px 0;padding:16px;border-radius:12px;background:#fdf2f8;border:1px solid #fbcfe8;">
              <p style="margin:0 0 8px;font-weight:600;color:#831843;">Briefing compartilhado</p>
              <p style="margin:0;color:#4c0519;white-space:pre-wrap;">${normalizedDescription.replace(/\n/g, '<br/>')}</p>
            </div>`
          : ''
      }
      <p style="margin:24px 0 16px;">
        Enquanto aguarda, conheça mais sobre nossos criadores e casos em
        <a href="https://data2content.ai" style="color:#6E1F93;font-weight:600;text-decoration:none;">data2content.ai</a>.
      </p>
      <p style="margin:0;color:#475569;font-size:14px;">— Equipe Data2Content</p>
    </div>
  `;

  return {
    subject: 'Recebemos seu briefing de campanha ✨',
    text,
    html,
  };
}
