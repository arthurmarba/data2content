// src/app/lib/billing/stripeReconciliationRun.ts
//
// Conferência banco × Stripe com o que dá para corrigir sem decisão humana.
// Usada pela rotina diária (`/api/cron/stripe-reconcile`) e pelo comando
// `npm run audit:stripe-subscriptions`.
//
// Corrige sozinha só o que não tira acesso de ninguém:
//  - quem paga uma assinatura viva que o banco não reconhece (o banco passa a
//    apontar para ela) — desde que isso não tire o Pro;
//  - quem ficou com um status sem acesso diferente do Stripe quando o Stripe diz
//    que a assinatura acabou (ex.: "atrasado" de quem já foi cancelado).
// O resto (Pro sem assinatura, cobrança dupla, pagante sem Pro...) só é relatado.
import type Stripe from "stripe";
import { stripe } from "@/app/lib/stripe";
import User from "@/app/models/User";
import { hasPlanPremiumAccess } from "@/utils/planStatus";
import {
  conferirAssinaturas,
  STATUS_ASSINATURA_VIVA,
  type ConferenciaAssinaturas,
  type UsuarioCobranca,
} from "./stripeReconciliation";
import {
  applyBillingStateToUser,
  applyEndedSubscriptionToUser,
  billingStateFromSubscription,
} from "./stripeSubscriptionSync";

/** Status do Stripe que dizem que a assinatura acabou. */
export const STATUS_STRIPE_ENCERRADO = new Set(["canceled", "incomplete_expired"]);

export type Correcao = {
  userId: string;
  tipo: "assinatura_gravada" | "status_encerrado";
  resultado: "corrigido" | "pulado";
  motivo?: string;
  antes?: string;
  depois?: string;
};

export type ResultadoConciliacao = {
  conferencia: ConferenciaAssinaturas;
  correcoes: Correcao[];
};

const dia = (d: unknown) => (d ? new Date(d as any).toISOString().slice(0, 10) : "—");
const retrato = (user: any) =>
  `${user.planStatus ?? "—"} · ${user.stripeSubscriptionId ?? "sem assinatura"} · expira ${dia(user.planExpiresAt)}`;

function clienteDe(sub: Stripe.Subscription): string | null {
  const customer = sub.customer as string | { id?: string } | null | undefined;
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id ?? null;
}

export async function listarAssinaturasStripe(): Promise<Stripe.Subscription[]> {
  const todas: Stripe.Subscription[] = [];
  for await (const sub of stripe.subscriptions.list({ status: "all", limit: 100 })) {
    todas.push(sub);
  }
  return todas;
}

export async function carregarUsuariosCobranca(): Promise<UsuarioCobranca[]> {
  const docs = await User.find(
    {},
    "role planStatus cancelAtPeriodEnd planExpiresAt stripeCustomerId stripeSubscriptionId"
  ).lean();
  return docs.map((doc: any) => ({
    id: String(doc._id),
    role: doc.role ?? null,
    planStatus: doc.planStatus ?? null,
    cancelAtPeriodEnd: doc.cancelAtPeriodEnd ?? null,
    planExpiresAt: doc.planExpiresAt ?? null,
    stripeCustomerId: doc.stripeCustomerId || null,
    stripeSubscriptionId: doc.stripeSubscriptionId || null,
  }));
}

/**
 * Aponta o banco para a assinatura viva que a pessoa paga. É a mesma regra da
 * tela de assinatura; não aplica se o resultado tirar o Pro de quem tem.
 */
export async function corrigirAssinaturaGravada(userId: string, vivaId: string): Promise<Correcao> {
  const base = { userId, tipo: "assinatura_gravada" as const };
  const user: any = await User.findById(userId);
  if (!user) return { ...base, resultado: "pulado", motivo: "usuário não encontrado" };

  const sub = await stripe.subscriptions.retrieve(vivaId);
  const cliente = clienteDe(sub);
  if (!STATUS_ASSINATURA_VIVA.has(String(sub.status))) {
    return { ...base, resultado: "pulado", motivo: `${vivaId} não está mais viva (${sub.status})` };
  }
  if (user.stripeCustomerId && cliente !== user.stripeCustomerId) {
    return { ...base, resultado: "pulado", motivo: `${vivaId} é de outro cliente` };
  }

  const estado = billingStateFromSubscription(sub);
  const tinhaPro = hasPlanPremiumAccess(user.planStatus, user.cancelAtPeriodEnd);
  const teraPro = hasPlanPremiumAccess(estado.effectiveStatus, estado.cancelAtPeriodEnd);
  if (tinhaPro && !teraPro) {
    return { ...base, resultado: "pulado", motivo: `tiraria o Pro (Stripe: ${sub.status}); olhar à mão` };
  }

  const antes = retrato(user);
  if (!applyBillingStateToUser(user, cliente, sub, estado)) {
    return { ...base, resultado: "pulado", motivo: "já estava em dia" };
  }
  await user.save();
  return { ...base, resultado: "corrigido", antes, depois: retrato(user) };
}

/**
 * Grava o fim da assinatura em quem ficou com outro status sem acesso — o que o
 * aviso de cancelamento teria gravado se não tivesse sido atropelado.
 */
export async function encerrarStatusPreso(
  userId: string,
  assinaturaId: string,
  planStatusVisto: string | null
): Promise<Correcao> {
  const base = { userId, tipo: "status_encerrado" as const };
  const user: any = await User.findById(userId);
  if (!user) return { ...base, resultado: "pulado", motivo: "usuário não encontrado" };
  if ((user.planStatus ?? null) !== planStatusVisto) {
    return { ...base, resultado: "pulado", motivo: "o status mudou desde a leitura" };
  }
  if (hasPlanPremiumAccess(user.planStatus, user.cancelAtPeriodEnd)) {
    return { ...base, resultado: "pulado", motivo: "tem Pro no banco; olhar à mão" };
  }

  const sub = await stripe.subscriptions.retrieve(assinaturaId);
  if (!STATUS_STRIPE_ENCERRADO.has(String(sub.status))) {
    return { ...base, resultado: "pulado", motivo: `${assinaturaId} não acabou (${sub.status})` };
  }
  if (user.stripeCustomerId && clienteDe(sub) !== user.stripeCustomerId) {
    return { ...base, resultado: "pulado", motivo: `${assinaturaId} é de outro cliente` };
  }

  const antes = retrato(user);
  applyEndedSubscriptionToUser(user, sub);
  await user.save();
  return { ...base, resultado: "corrigido", antes, depois: retrato(user) };
}

/** Confere e, se `corrigir`, aplica as correções seguras. Nunca tira acesso. */
export async function executarConciliacao({ corrigir }: { corrigir: boolean }): Promise<ResultadoConciliacao> {
  const [usuarios, assinaturas] = await Promise.all([carregarUsuariosCobranca(), listarAssinaturasStripe()]);
  const conferencia = conferirAssinaturas(usuarios, assinaturas);
  const correcoes: Correcao[] = [];
  if (!corrigir) return { conferencia, correcoes };

  for (const p of conferencia.pagaOutraAssinatura) {
    correcoes.push(await corrigirAssinaturaGravada(p.userId, p.viva.id));
  }
  for (const s of conferencia.statusDiferente) {
    if (!STATUS_STRIPE_ENCERRADO.has(s.esperado)) continue;
    correcoes.push(await encerrarStatusPreso(s.userId, s.assinatura.id, s.planStatus));
  }
  return { conferencia, correcoes };
}

export type PendenciasHumanas = ReturnType<typeof pendenciasHumanas>;

/** O que sobrou para uma pessoa olhar depois das correções automáticas. */
export function pendenciasHumanas({ conferencia, correcoes }: ResultadoConciliacao) {
  const corrigidos = new Set(correcoes.filter((c) => c.resultado === "corrigido").map((c) => c.userId));
  return {
    pagaSemPro: conferencia.pagaSemPro,
    cobrancaDupla: conferencia.cobrancaDupla,
    vivaSemUsuario: conferencia.vivaSemUsuario.filter((v) => !v.cancelaNoFim),
    pagaOutraAssinatura: conferencia.pagaOutraAssinatura.filter((p) => !corrigidos.has(p.userId)),
    statusDiferente: conferencia.statusDiferente.filter((s) => !corrigidos.has(s.userId)),
    proSemAssinatura: conferencia.proSemAssinatura,
    gravadaInexistente: conferencia.gravadaInexistente,
  };
}

/**
 * Pede atenção de alguém hoje? Dinheiro (pagante sem Pro, cobrança dupla,
 * assinatura sem conta), correção feita ou pulada. Pro sem assinatura e ids
 * velhos são estáveis e só entram no resumo de segunda-feira.
 */
export function precisaAtencao(resultado: ResultadoConciliacao, p: PendenciasHumanas): boolean {
  return (
    resultado.correcoes.length > 0 ||
    p.pagaSemPro.length > 0 ||
    p.cobrancaDupla.length > 0 ||
    p.vivaSemUsuario.length > 0 ||
    p.pagaOutraAssinatura.length > 0 ||
    p.statusDiferente.length > 0
  );
}

function destinatariosRelatorio(): string[] {
  // Sem lista própria, vai para quem já recebe os resumos internos da equipe.
  const lista = process.env.STRIPE_RECONCILE_REPORT_TO || process.env.MCP_USAGE_REPORT_TO || "";
  return lista
    .split(",")
    .map((value) => value.trim())
    .filter((value) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value));
}

/**
 * Rotina diária: corrige o que é seguro e manda o relatório quando algo pede
 * atenção — ou toda segunda, com o resumo completo. Devolve só contagens.
 */
export async function conciliarEAvisar(now: Date = new Date()) {
  const resultado = await executarConciliacao({ corrigir: true });
  const pendencias = pendenciasHumanas(resultado);
  const resumo = {
    usuarios: resultado.conferencia.totais.usuarios,
    assinaturas: resultado.conferencia.totais.assinaturas,
    batem: resultado.conferencia.totais.batem,
    corrigidos: resultado.correcoes.filter((c) => c.resultado === "corrigido").length,
    pulados: resultado.correcoes.filter((c) => c.resultado === "pulado").length,
    pagaSemPro: pendencias.pagaSemPro.length,
    cobrancaDupla: pendencias.cobrancaDupla.length,
    vivaSemUsuario: pendencias.vivaSemUsuario.length,
    statusDiferente: pendencias.statusDiferente.length,
    proSemAssinatura: pendencias.proSemAssinatura.length,
    gravadaInexistente: pendencias.gravadaInexistente.length,
  };

  const destinatarios = destinatariosRelatorio();
  const segunda = now.getUTCDay() === 1;
  if (!destinatarios.length) return { ...resumo, enviados: 0, semEnvio: "sem_destinatario" as const };
  if (!precisaAtencao(resultado, pendencias) && !segunda) {
    return { ...resumo, enviados: 0, semEnvio: "nada_novo" as const };
  }

  const { sendStripeReconcileReportEmail } = await import("@/app/lib/emailService");
  for (const to of destinatarios) await sendStripeReconcileReportEmail(to, resultado, pendencias);
  return { ...resumo, enviados: destinatarios.length, semEnvio: null };
}
