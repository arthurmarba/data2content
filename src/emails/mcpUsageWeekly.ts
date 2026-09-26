import type { McpUsageReport } from "@/app/lib/mcp/usageReport";

/**
 * Resumo semanal interno do uso do conector (ChatGPT e Claude), para a equipe.
 * Mostra adesão, o que mais usam, onde travam e os pedidos mais recentes.
 */

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const TOOL_LABELS: Record<string, string> = {
  get_account_state: "estado da conta",
  get_creator_map: "mapa",
  list_content_ideas: "pautas",
  get_script_evidence_pack: "roteiro com referências próprias",
  generate_script_draft: "roteiro pelo motor D2C",
  critique_script_against_creator_dna: "revisão de roteiro",
  analyze_creator_period: "análise do período",
  get_creator_intelligence_snapshot: "análise completa",
  get_creator_content_dna: "DNA de conteúdo",
  recommend_collab_creators: "collabs",
  research_inspiration_content: "inspirações",
  build_creator_radar: "radar",
  find_campaign_opportunities: "publis",
  get_follower_growth: "seguidores",
  list_top_content: "melhores posts",
};

function label(tool: string): string {
  if (tool.startsWith("prompt:")) return `atalho ${tool.slice(7)}`;
  return TOOL_LABELS[tool] ?? tool;
}

export function mcpUsageWeeklyEmail(report: McpUsageReport, adminUrl: string) {
  const { summary, retention, period } = report;
  const subject = `Conector D2C: ${summary.activeCreators} creators ativos (${period.startDate} a ${period.endDate})`;
  const retentionLine = retention.rate === null
    ? "Sem período anterior para comparar."
    : `${retention.returnedFromPreviousPeriod} de ${retention.activeInPreviousPeriod} voltaram da semana anterior (${Math.round(retention.rate * 100)}%); ${retention.newThisPeriod} novos.`;
  const tools = report.topTools.slice(0, 6).map((tool) => `${label(tool.tool)}: ${tool.calls} usos, ${tool.creators} creators`);
  const gates = report.planGates.map((gate) => `${gate.feature}: ${gate.hits} vezes, ${gate.creators} creators`);
  const requests = report.requests.slice(0, 12).map((item) => `${item.username ? `@${item.username}` : item.creatorRef} · ${label(item.tool.replace(/^atalho:/, "prompt:"))} · ${item.request ?? "(sem texto)"}`);
  const creators = report.perCreator.slice(0, 8).map((creator) =>
    `${creator.username ? `@${creator.username}` : creator.name ?? creator.creatorRef}: ${creator.activeDays} dias, ${creator.sessions} conversas, ~${creator.estimatedMinutes} min`);

  const text = [
    `Uso do conector de ${period.startDate} a ${period.endDate}`,
    "",
    `${summary.activeCreators} creators ativos (Claude ${summary.activeByClient.claude}, ChatGPT ${summary.activeByClient.chatgpt}), ${summary.calls} chamadas, ${summary.sessions} conversas, ~${summary.estimatedMinutes} min estimados.`,
    `Em média ${summary.averageActiveDaysPerCreator} dias de uso por creator. ${retentionLine}`,
    "",
    "Mais usado:", ...tools.map((line) => `- ${line}`),
    ...(gates.length ? ["", "Limites de plano batidos:", ...gates.map((line) => `- ${line}`)] : []),
    ...(creators.length ? ["", "Quem mais usou:", ...creators.map((line) => `- ${line}`)] : []),
    ...(requests.length ? ["", "Pedidos recentes:", ...requests.map((line) => `- ${line}`)] : []),
    "",
    `Para agrupar as dores: pergunte ao Claude, no conector administrativo, "o que os creators mais pediram esta semana?" (${adminUrl}).`,
    "Tempo é estimado pelos intervalos entre chamadas; pedidos são o que chegou às ferramentas, não a pergunta escrita.",
  ].join("\n");

  const list = (items: string[]) => items.length
    ? `<ul style="margin:0 0 20px;padding-left:18px;">${items.map((item) => `<li style="margin:0 0 6px;">${escapeHtml(item)}</li>`).join("")}</ul>`
    : "";
  const html = `
    <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;max-width:560px;margin:0 auto;padding:28px 20px;color:#171717;font-size:14px;line-height:1.55;">
      <p style="font-size:12px;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#71717a;margin:0 0 8px;">Conector D2C · ${escapeHtml(period.startDate)} a ${escapeHtml(period.endDate)}</p>
      <p style="font-size:28px;font-weight:800;margin:0;">${summary.activeCreators} creators ativos</p>
      <p style="margin:6px 0 20px;color:#52525b;">Claude ${summary.activeByClient.claude} · ChatGPT ${summary.activeByClient.chatgpt} · ${summary.calls} chamadas · ${summary.sessions} conversas · ~${summary.estimatedMinutes} min estimados · média de ${summary.averageActiveDaysPerCreator} dias de uso</p>
      <p style="margin:0 0 20px;">${escapeHtml(retentionLine)}</p>
      <p style="font-weight:700;margin:0 0 6px;">Mais usado</p>${list(tools)}
      ${gates.length ? `<p style="font-weight:700;margin:0 0 6px;">Limites de plano batidos</p>${list(gates)}` : ""}
      ${creators.length ? `<p style="font-weight:700;margin:0 0 6px;">Quem mais usou</p>${list(creators)}` : ""}
      ${requests.length ? `<p style="font-weight:700;margin:0 0 6px;">Pedidos recentes</p>${list(requests)}` : ""}
      <p style="color:#71717a;font-size:12px;margin:24px 0 0;">Para agrupar as dores, pergunte ao Claude no conector administrativo: "o que os creators mais pediram esta semana?". Tempo é estimado pelos intervalos entre chamadas; pedidos são o que chegou às ferramentas, não a pergunta escrita.</p>
    </div>
  `;
  return { subject, text, html };
}
