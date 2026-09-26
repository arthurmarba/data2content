import type Stripe from "stripe";
import {
  applyBillingStateToUser,
  billingStateFromSubscription,
  pickBestSubscription,
} from "./stripeSubscriptionSync";

const NOW = Date.UTC(2026, 8, 26, 12, 0, 0);
const sec = (ms: number) => Math.floor(ms / 1000);
const DAY = 24 * 60 * 60 * 1000;

function sub(partial: Record<string, any>): Stripe.Subscription {
  return {
    id: "sub_1",
    customer: "cus_1",
    status: "active",
    created: sec(NOW - 30 * DAY),
    cancel_at_period_end: false,
    cancel_at: null,
    trial_end: null,
    items: {
      data: [
        {
          current_period_end: sec(NOW + 10 * DAY),
          price: { id: "price_mensal", recurring: { interval: "month" } },
        },
      ],
    },
    ...partial,
  } as unknown as Stripe.Subscription;
}

describe("pickBestSubscription", () => {
  it("prefere a viva mais recente e ignora incomplete_expired", () => {
    const velha = sub({ id: "sub_velha", status: "incomplete_expired", created: 1 });
    const cancelada = sub({ id: "sub_cancelada", status: "canceled", created: 2 });
    const ativa = sub({ id: "sub_ativa", status: "active", created: 3 });
    expect(pickBestSubscription([velha, cancelada, ativa])?.id).toBe("sub_ativa");
    expect(pickBestSubscription([velha])).toBeNull();
  });
});

describe("billingStateFromSubscription", () => {
  it("assinatura ativa vira active com fim do ciclo do item", () => {
    const estado = billingStateFromSubscription(sub({}), NOW);
    expect(estado.statusForDb).toBe("active");
    expect(estado.effectiveStatus).toBe("active");
    expect(estado.planType).toBe("monthly");
    expect(estado.planExpiresAt?.getTime()).toBe(sec(NOW + 10 * DAY) * 1000);
  });

  it("cancelamento agendado grava active e mostra non_renewing", () => {
    const estado = billingStateFromSubscription(sub({ cancel_at_period_end: true }), NOW);
    expect(estado.statusForDb).toBe("active");
    expect(estado.effectiveStatus).toBe("non_renewing");
  });

  it("cancelamento agendado com ciclo já vencido vira canceled", () => {
    const vencida = sub({
      cancel_at_period_end: true,
      items: { data: [{ current_period_end: sec(NOW - DAY), price: { id: "p", recurring: { interval: "year" } } }] },
    });
    const estado = billingStateFromSubscription(vencida, NOW);
    expect(estado.statusForDb).toBe("canceled");
    expect(estado.cancelAtPeriodEnd).toBe(false);
  });

  it("incomplete vira pending sem data de expiração", () => {
    const estado = billingStateFromSubscription(sub({ status: "incomplete" }), NOW);
    expect(estado.statusForDb).toBe("pending");
    expect(estado.planExpiresAt).toBeNull();
  });
});

describe("applyBillingStateToUser", () => {
  it("troca a assinatura gravada pela viva e diz que mudou", () => {
    const viva = sub({ id: "sub_viva" });
    const user: Record<string, any> = {
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_morta",
      planStatus: "active",
    };
    const mudou = applyBillingStateToUser(user, "cus_1", viva, billingStateFromSubscription(viva, NOW));
    expect(mudou).toBe(true);
    expect(user.stripeSubscriptionId).toBe("sub_viva");
    expect(user.stripePriceId).toBe("price_mensal");
    expect(user.planStatus).toBe("active");
    expect(user.planType).toBe("monthly");
  });

  it("não acusa mudança quando já está em dia", () => {
    const viva = sub({ id: "sub_viva" });
    const estado = billingStateFromSubscription(viva, NOW);
    const user: Record<string, any> = {};
    applyBillingStateToUser(user, "cus_1", viva, estado);
    expect(applyBillingStateToUser(user, "cus_1", viva, estado)).toBe(false);
  });
});
