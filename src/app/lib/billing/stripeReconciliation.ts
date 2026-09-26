// src/app/lib/billing/stripeReconciliation.ts
//
// Conferência banco × Stripe. O webhook é o único caminho que mantém o banco em
// dia; quando um aviso se perde ou chega fora de ordem, ninguém fica sabendo.
// Esta função só compara e separa as divergências por tipo — não grava nada.
// Quem roda é `npm run audit:stripe-subscriptions`.
import type Stripe from "stripe";
import { hasPlanPremiumAccess } from "@/utils/planStatus";
import {
  billingStateFromSubscription,
  pickBestSubscription,
  type SubscriptionBillingState,
} from "./stripeSubscriptionSync";

/** Assinatura que ainda cobra ou pode voltar a cobrar. */
export const STATUS_ASSINATURA_VIVA = new Set(["active", "trialing", "past_due", "unpaid"]);

/** Status sem acesso que dizem a mesma coisa: acabou. */
const STATUS_ENCERRADO = new Set(["canceled", "inactive", "expired", "incomplete_expired"]);

export type UsuarioCobranca = {
  id: string;
  role?: string | null;
  planStatus?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  planExpiresAt?: Date | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
};

export type ResumoAssinatura = {
  id: string;
  status: string;
  cancelaNoFim: boolean;
};

export type ConferenciaAssinaturas = {
  totais: { usuarios: number; assinaturas: number; batem: number };
  /** Paga uma assinatura viva, mas o banco aponta outra. O webhook ignora os avisos
   *  da que ele não conhece: se ela for cancelada, o Pro continua. Corrigível. */
  pagaOutraAssinatura: Array<{
    userId: string;
    planStatus: string | null;
    gravada: ResumoAssinatura | null;
    viva: ResumoAssinatura;
  }>;
  /** Mais de uma assinatura viva no mesmo cliente: pode estar pagando em dobro. */
  cobrancaDupla: Array<{ userId: string; planStatus: string | null; gravadaId: string | null; vivas: ResumoAssinatura[] }>;
  /** Tem Pro no banco, mas nenhuma assinatura do Stripe sustenta. Cortesia ou vazamento. */
  proSemAssinatura: Array<{
    userId: string;
    role: string | null;
    planStatus: string | null;
    planExpiresAt: Date | null;
    assinatura: ResumoAssinatura | null;
  }>;
  /** O Stripe sustenta o Pro, mas o banco não dá acesso. */
  pagaSemPro: Array<{ userId: string; planStatus: string | null; assinatura: ResumoAssinatura }>;
  /** Mesmo acesso dos dois lados, rótulo diferente (ex.: "atrasado" × cancelada). */
  statusDiferente: Array<{
    userId: string;
    planStatus: string | null;
    esperado: string;
    assinatura: ResumoAssinatura;
  }>;
  gravadaInexistente: Array<{ userId: string; assinaturaId: string }>;
  vivaSemUsuario: Array<ResumoAssinatura & { criadaEm: Date }>;
};

function clienteDe(sub: Stripe.Subscription): string | null {
  const customer = sub.customer as string | { id?: string } | null | undefined;
  if (!customer) return null;
  return typeof customer === "string" ? customer : customer.id ?? null;
}

function resumir(sub: Stripe.Subscription): ResumoAssinatura {
  return { id: sub.id, status: String(sub.status), cancelaNoFim: Boolean(sub.cancel_at_period_end) };
}

function statusCompativel(planStatus: string | null, estado: SubscriptionBillingState): boolean {
  if (!planStatus) return false;
  if (planStatus === estado.statusForDb || planStatus === estado.effectiveStatus) return true;
  if (estado.isTrialing && planStatus === "trial") return true;
  return STATUS_ENCERRADO.has(estado.statusForDb) && STATUS_ENCERRADO.has(planStatus);
}

export function conferirAssinaturas(
  usuarios: UsuarioCobranca[],
  assinaturas: Stripe.Subscription[],
  nowMs: number = Date.now()
): ConferenciaAssinaturas {
  const resultado: ConferenciaAssinaturas = {
    totais: { usuarios: 0, assinaturas: assinaturas.length, batem: 0 },
    pagaOutraAssinatura: [],
    cobrancaDupla: [],
    proSemAssinatura: [],
    pagaSemPro: [],
    statusDiferente: [],
    gravadaInexistente: [],
    vivaSemUsuario: [],
  };

  const porId = new Map(assinaturas.map((sub) => [sub.id, sub]));
  const porCliente = new Map<string, Stripe.Subscription[]>();
  for (const sub of assinaturas) {
    const cliente = clienteDe(sub);
    if (!cliente) continue;
    porCliente.set(cliente, [...(porCliente.get(cliente) ?? []), sub]);
  }

  const clientesComUsuario = new Set<string>();
  const assinaturasComUsuario = new Set<string>();

  for (const usuario of usuarios) {
    const planStatus = usuario.planStatus ?? null;
    const temPro = hasPlanPremiumAccess(planStatus, usuario.cancelAtPeriodEnd);
    const gravada = usuario.stripeSubscriptionId ? porId.get(usuario.stripeSubscriptionId) ?? null : null;
    const cliente = usuario.stripeCustomerId || (gravada ? clienteDe(gravada) : null);

    if (cliente) clientesComUsuario.add(cliente);
    if (usuario.stripeSubscriptionId) assinaturasComUsuario.add(usuario.stripeSubscriptionId);

    // Gratuito sem nenhum vínculo com o Stripe: nada a conferir.
    if (!temPro && !cliente && !usuario.stripeSubscriptionId) continue;
    resultado.totais.usuarios += 1;

    if (usuario.stripeSubscriptionId && !gravada) {
      resultado.gravadaInexistente.push({ userId: usuario.id, assinaturaId: usuario.stripeSubscriptionId });
    }

    const doCliente = cliente ? porCliente.get(cliente) ?? [] : [];
    const vivas = doCliente.filter((sub) => STATUS_ASSINATURA_VIVA.has(String(sub.status)));
    if (vivas.length > 1) {
      resultado.cobrancaDupla.push({
        userId: usuario.id,
        planStatus,
        gravadaId: usuario.stripeSubscriptionId ?? null,
        vivas: vivas.map(resumir),
      });
      continue;
    }

    // Mesma escolha da tela de assinatura: a melhor do cliente; se nenhuma serve, a gravada.
    const melhor = pickBestSubscription(doCliente) ?? gravada;

    if (!melhor) {
      if (temPro) {
        resultado.proSemAssinatura.push({
          userId: usuario.id,
          role: usuario.role ?? null,
          planStatus,
          planExpiresAt: usuario.planExpiresAt ?? null,
          assinatura: null,
        });
      } else {
        resultado.totais.batem += 1;
      }
      continue;
    }

    if (STATUS_ASSINATURA_VIVA.has(String(melhor.status)) && melhor.id !== usuario.stripeSubscriptionId) {
      resultado.pagaOutraAssinatura.push({
        userId: usuario.id,
        planStatus,
        gravada: gravada ? resumir(gravada) : null,
        viva: resumir(melhor),
      });
      continue;
    }

    const estado = billingStateFromSubscription(melhor, nowMs);
    const stripeDaPro = hasPlanPremiumAccess(estado.effectiveStatus, estado.cancelAtPeriodEnd);

    if (temPro && !stripeDaPro) {
      resultado.proSemAssinatura.push({
        userId: usuario.id,
        role: usuario.role ?? null,
        planStatus,
        planExpiresAt: usuario.planExpiresAt ?? null,
        assinatura: resumir(melhor),
      });
    } else if (!temPro && stripeDaPro) {
      resultado.pagaSemPro.push({ userId: usuario.id, planStatus, assinatura: resumir(melhor) });
    } else if (!statusCompativel(planStatus, estado)) {
      resultado.statusDiferente.push({
        userId: usuario.id,
        planStatus,
        esperado: estado.statusForDb,
        assinatura: resumir(melhor),
      });
    } else {
      resultado.totais.batem += 1;
    }
  }

  for (const sub of assinaturas) {
    if (!STATUS_ASSINATURA_VIVA.has(String(sub.status))) continue;
    if (assinaturasComUsuario.has(sub.id)) continue;
    const cliente = clienteDe(sub);
    if (cliente && clientesComUsuario.has(cliente)) continue;
    resultado.vivaSemUsuario.push({ ...resumir(sub), criadaEm: new Date((sub.created ?? 0) * 1000) });
  }

  return resultado;
}
