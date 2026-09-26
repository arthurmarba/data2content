/**
 * E-mail semanal de quem conectou a Data2Content por um chat e não assinou.
 *
 * Uma pauta do mapa da pessoa por semana, com o gancho. É comunicação do
 * serviço, não marketing: a política de privacidade exige consentimento para
 * e-mail de marketing, e quem conecta pelo chat não deu esse consentimento. Por
 * isso nada de plano ou preço aqui. A oferta fica na página de chegada, para
 * onde o botão leva.
 */

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export interface PluginWeeklyEmailParams {
  name?: string | null;
  clientLabel: string;
  narrative: string | null;
  idea: { title: string; hook: string | null; territory: string | null };
  profileUrl: string;
  unsubscribeUrl: string;
}

export function pluginWeeklyEmail(params: PluginWeeklyEmailParams) {
  const greeting = params.name ? `Oi, ${params.name.split(" ")[0]}!` : "Oi!";
  const title = params.idea.title.length > 70 ? `${params.idea.title.slice(0, 69).trimEnd()}…` : params.idea.title;
  const subject = `O que gravar esta semana: ${title}`;

  const text = [
    greeting,
    "",
    "Uma pauta do seu mapa para esta semana:",
    "",
    params.idea.title,
    ...(params.idea.hook ? [`Gancho: "${params.idea.hook}"`] : []),
    ...(params.idea.territory ? [`Território: ${params.idea.territory}`] : []),
    ...(params.narrative ? ["", `Ela nasce da sua narrativa: ${params.narrative}`] : []),
    "",
    `Ver no seu perfil: ${params.profileUrl}`,
    `Você também pode pedir no ${params.clientLabel}: é só perguntar o que postar.`,
    "",
    `Você recebe este e-mail porque conectou a Data2Content ao ${params.clientLabel}.`,
    `Para não receber mais: ${params.unsubscribeUrl}`,
  ].join("\n");

  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#171717;">
      <p style="font-size:16px;margin:0 0 20px;">${escapeHtml(greeting)}</p>
      <p style="font-size:15px;line-height:1.6;margin:0 0 16px;">Uma pauta do seu mapa para esta semana:</p>
      <div style="background:#f5f5f4;border-radius:20px;padding:20px;margin:0 0 20px;">
        <p style="font-size:17px;font-weight:700;line-height:1.35;margin:0;">${escapeHtml(params.idea.title)}</p>
        ${params.idea.hook ? `<p style="font-size:14px;line-height:1.6;color:#52525b;margin:10px 0 0;">“${escapeHtml(params.idea.hook)}”</p>` : ""}
        ${params.idea.territory ? `<p style="display:inline-block;font-size:12px;font-weight:600;border:1px solid #3d3d3d;border-radius:999px;padding:3px 10px;margin:12px 0 0;">${escapeHtml(params.idea.territory)}</p>` : ""}
      </div>
      ${params.narrative ? `<p style="font-size:14px;line-height:1.6;color:#52525b;margin:0 0 20px;">Ela nasce da sua narrativa: <strong style="color:#171717;">${escapeHtml(params.narrative)}</strong></p>` : ""}
      <p style="margin:0 0 12px;">
        <a href="${escapeHtml(params.profileUrl)}" style="display:inline-block;background:#171717;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:999px;padding:12px 22px;">Ver no meu perfil</a>
      </p>
      <p style="font-size:13px;line-height:1.6;color:#52525b;margin:0 0 28px;">
        Você também pode pedir no ${escapeHtml(params.clientLabel)}: é só perguntar o que postar.
      </p>
      <p style="font-size:12px;line-height:1.6;color:#a1a1aa;margin:0;">
        Você recebe este e-mail porque conectou a Data2Content ao ${escapeHtml(params.clientLabel)}.
        <a href="${escapeHtml(params.unsubscribeUrl)}" style="color:#a1a1aa;">Não quero mais receber</a>.
      </p>
    </div>
  `;

  return { subject, text, html };
}
