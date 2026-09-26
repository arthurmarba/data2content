import type {
  Correcao,
  PendenciasHumanas,
  ResultadoConciliacao,
} from "@/app/lib/billing/stripeReconciliationRun";

/**
 * Relatório interno da conferência banco × Stripe. Só ids de usuário e de
 * assinatura — nunca nome ou e-mail de cliente.
 */

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

const dia = (d: unknown) => (d ? new Date(d as any).toISOString().slice(0, 10) : "—");

function linhaCorrecao(c: Correcao): string {
  if (c.resultado === "corrigido") return `usuário ${c.userId}: ${c.antes} → ${c.depois}`;
  return `usuário ${c.userId}: pulado (${c.motivo})`;
}

export function stripeReconcileReportEmail(
  resultado: ResultadoConciliacao,
  p: PendenciasHumanas,
  dataRef: Date = new Date()
) {
  const { conferencia, correcoes } = resultado;
  const corrigidas = correcoes.filter((c) => c.resultado === "corrigido");
  const puladas = correcoes.filter((c) => c.resultado === "pulado");

  const secoes: Array<{ titulo: string; nota: string; linhas: string[] }> = [
    {
      titulo: "Corrigido automaticamente",
      nota: "Banco alinhado ao Stripe sem tirar acesso de ninguém.",
      linhas: corrigidas.map(linhaCorrecao),
    },
    {
      titulo: "Pagam e estão sem Pro",
      nota: "Gente pagando sem acesso. Prioridade.",
      linhas: p.pagaSemPro.map((x) => `usuário ${x.userId} (${x.planStatus}): ${x.assinatura.id} (${x.assinatura.status})`),
    },
    {
      titulo: "Mais de uma assinatura viva no mesmo cliente",
      nota: "Pode estar pagando em dobro. Olhar no Stripe.",
      linhas: p.cobrancaDupla.map((x) => `usuário ${x.userId}: ${x.vivas.map((v) => `${v.id} (${v.status})`).join(", ")}`),
    },
    {
      titulo: "Assinatura viva sem ninguém no banco",
      nota: "Alguém paga sem conta ligada.",
      linhas: p.vivaSemUsuario.map((v) => `${v.id} (${v.status}), criada ${dia(v.criadaEm)}`),
    },
    {
      titulo: "Não corrigido: precisa de decisão",
      nota: "A correção automática pulou estes casos.",
      linhas: puladas.map(linhaCorrecao),
    },
    {
      titulo: "Status diferente do Stripe",
      nota: "Mesmo acesso dos dois lados, rótulo diferente.",
      linhas: p.statusDiferente.map((x) => `usuário ${x.userId}: banco ${x.planStatus}, Stripe pede ${x.esperado} (${x.assinatura.id})`),
    },
    {
      titulo: "Pro no banco sem assinatura que sustente",
      nota: "Cortesia dada à mão ou vazamento.",
      linhas: p.proSemAssinatura.map(
        (x) => `usuário ${x.userId} (${x.role ?? "—"}, ${x.planStatus}, expira ${dia(x.planExpiresAt)})${x.assinatura ? `: ${x.assinatura.id} (${x.assinatura.status})` : ""}`
      ),
    },
    {
      titulo: "Assinatura gravada que não existe no Stripe",
      nota: "Id velho ou de outro ambiente.",
      linhas: p.gravadaInexistente.map((x) => `usuário ${x.userId}: ${x.assinaturaId}`),
    },
  ];

  const data = dia(dataRef);
  const subject = `Conferência Stripe ${data}: ${corrigidas.length} corrigido(s), ${p.pagaSemPro.length + p.cobrancaDupla.length + p.vivaSemUsuario.length} caso(s) de dinheiro`;
  const cabecalho = `Usuários com cobrança: ${conferencia.totais.usuarios} · assinaturas no Stripe: ${conferencia.totais.assinaturas} · batem: ${conferencia.totais.batem}`;
  const visiveis = secoes.filter((s) => s.linhas.length > 0);

  const text = [
    `Conferência banco × Stripe — ${data}`,
    cabecalho,
    ...visiveis.flatMap((s) => ["", `${s.titulo} — ${s.linhas.length}`, s.nota, ...s.linhas.map((l) => `- ${l}`)]),
    "",
    "Detalhe e correção manual: npm run audit:stripe-subscriptions",
  ].join("\n");

  const html = [
    `<h2 style="font-family:sans-serif">Conferência banco × Stripe — ${escapeHtml(data)}</h2>`,
    `<p style="font-family:sans-serif;color:#555">${escapeHtml(cabecalho)}</p>`,
    ...visiveis.map(
      (s) =>
        `<h3 style="font-family:sans-serif;margin-bottom:4px">${escapeHtml(s.titulo)} — ${s.linhas.length}</h3>` +
        `<p style="font-family:sans-serif;color:#555;margin-top:0">${escapeHtml(s.nota)}</p>` +
        `<ul style="font-family:monospace;font-size:12px">${s.linhas.map((l) => `<li>${escapeHtml(l)}</li>`).join("")}</ul>`
    ),
    `<p style="font-family:sans-serif;color:#555">Detalhe e correção manual: <code>npm run audit:stripe-subscriptions</code></p>`,
  ].join("\n");

  return { subject, text, html };
}
