import type Stripe from "stripe";
import { conferirAssinaturas, type UsuarioCobranca } from "./stripeReconciliation";

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);
const sec = (ms: number) => Math.floor(ms / 1000);
const DAY = 24 * 60 * 60 * 1000;

function sub(id: string, customer: string, status: string, extra: Record<string, any> = {}): Stripe.Subscription {
  return {
    id,
    customer,
    status,
    created: sec(NOW - 30 * DAY),
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    items: {
      data: [{ current_period_end: sec(NOW + 10 * DAY), price: { id: "price", recurring: { interval: "month" } } }],
    },
    ...extra,
  } as unknown as Stripe.Subscription;
}

function usuario(id: string, partial: Partial<UsuarioCobranca>): UsuarioCobranca {
  return { id, role: "user", ...partial };
}

describe("conferirAssinaturas", () => {
  it("quem bate com o Stripe não aparece em nenhuma lista", () => {
    const r = conferirAssinaturas(
      [
        usuario("u1", { planStatus: "active", stripeCustomerId: "c1", stripeSubscriptionId: "s1" }),
        usuario("u2", { planStatus: "non_renewing", stripeCustomerId: "c2", stripeSubscriptionId: "s2" }),
        usuario("u3", { planStatus: "inactive", stripeCustomerId: "c3", stripeSubscriptionId: "s3" }),
        usuario("gratis", { planStatus: "inactive" }),
      ],
      [
        sub("s1", "c1", "active"),
        sub("s2", "c2", "active", { cancel_at_period_end: true }),
        sub("s3", "c3", "incomplete_expired"),
      ],
      NOW
    );
    expect(r.totais).toEqual({ usuarios: 3, assinaturas: 3, batem: 3 });
    expect(r.pagaOutraAssinatura).toHaveLength(0);
    expect(r.statusDiferente).toHaveLength(0);
  });

  it("acha quem paga uma assinatura que o banco não reconhece", () => {
    const r = conferirAssinaturas(
      [usuario("u1", { planStatus: "active", stripeCustomerId: "c1", stripeSubscriptionId: "s_morta" })],
      [sub("s_morta", "c1", "incomplete_expired"), sub("s_viva", "c1", "active")],
      NOW
    );
    expect(r.pagaOutraAssinatura).toEqual([
      {
        userId: "u1",
        planStatus: "active",
        gravada: { id: "s_morta", status: "incomplete_expired", cancelaNoFim: false },
        viva: { id: "s_viva", status: "active", cancelaNoFim: false },
      },
    ]);
  });

  it("duas assinaturas vivas no mesmo cliente vão para cobrança dupla, não para correção", () => {
    const r = conferirAssinaturas(
      [usuario("u1", { planStatus: "active", stripeCustomerId: "c1", stripeSubscriptionId: "s_a" })],
      [sub("s_a", "c1", "active"), sub("s_b", "c1", "active")],
      NOW
    );
    expect(r.cobrancaDupla.map((d) => d.userId)).toEqual(["u1"]);
    expect(r.pagaOutraAssinatura).toHaveLength(0);
  });

  it("Pro no banco sem assinatura que sustente", () => {
    const r = conferirAssinaturas(
      [
        usuario("cortesia", { planStatus: "active", role: "admin" }),
        usuario("expirou", { planStatus: "active", stripeCustomerId: "c1", stripeSubscriptionId: "s1" }),
      ],
      [sub("s1", "c1", "canceled")],
      NOW
    );
    expect(r.proSemAssinatura.map((p) => [p.userId, p.assinatura?.status ?? null])).toEqual([
      ["cortesia", null],
      ["expirou", "canceled"],
    ]);
  });

  it("atrasado no banco com assinatura já cancelada é status diferente, sem mudar acesso", () => {
    const r = conferirAssinaturas(
      [usuario("u1", { planStatus: "past_due", stripeCustomerId: "c1", stripeSubscriptionId: "s1" })],
      [sub("s1", "c1", "canceled")],
      NOW
    );
    expect(r.statusDiferente).toEqual([
      {
        userId: "u1",
        planStatus: "past_due",
        esperado: "canceled",
        assinatura: { id: "s1", status: "canceled", cancelaNoFim: false },
      },
    ]);
    expect(r.proSemAssinatura).toHaveLength(0);
  });

  it("paga e está sem Pro no banco", () => {
    const r = conferirAssinaturas(
      [usuario("u1", { planStatus: "inactive", stripeCustomerId: "c1", stripeSubscriptionId: "s1" })],
      [sub("s1", "c1", "active")],
      NOW
    );
    expect(r.pagaSemPro.map((p) => p.userId)).toEqual(["u1"]);
  });

  it("assinatura viva sem usuário e assinatura gravada que não existe", () => {
    const r = conferirAssinaturas(
      [usuario("u1", { planStatus: "inactive", stripeCustomerId: "c1", stripeSubscriptionId: "s_sumiu" })],
      [sub("s_orfa", "c_sem_usuario", "active", { cancel_at_period_end: true })],
      NOW
    );
    expect(r.gravadaInexistente).toEqual([{ userId: "u1", assinaturaId: "s_sumiu" }]);
    expect(r.vivaSemUsuario.map((v) => [v.id, v.cancelaNoFim])).toEqual([["s_orfa", true]]);
  });
});
