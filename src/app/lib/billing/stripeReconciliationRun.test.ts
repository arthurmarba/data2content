/** @jest-environment node */

jest.mock("@/app/lib/stripe", () => ({
  stripe: { subscriptions: { retrieve: jest.fn(), list: jest.fn() } },
}));
jest.mock("@/app/models/User", () => ({ __esModule: true, default: { findById: jest.fn(), find: jest.fn() } }));

import { stripe } from "@/app/lib/stripe";
import User from "@/app/models/User";
import {
  corrigirAssinaturaGravada,
  encerrarStatusPreso,
  pendenciasHumanas,
  precisaAtencao,
} from "./stripeReconciliationRun";

const retrieve = (stripe as any).subscriptions.retrieve as jest.Mock;
const findById = (User as any).findById as jest.Mock;

function usuario(overrides: Record<string, unknown>) {
  return {
    _id: "u1",
    stripeCustomerId: "cus_1",
    save: jest.fn(async function save() { return this; }),
    ...overrides,
  } as any;
}

function assinaturaViva(status: string) {
  return {
    id: "sub_viva",
    customer: "cus_1",
    status,
    cancel_at_period_end: false,
    items: { data: [{ price: { id: "price_m", recurring: { interval: "month" } }, current_period_end: 1_790_000_000 }] },
  };
}

beforeEach(() => jest.clearAllMocks());

describe("encerrarStatusPreso", () => {
  test("grava o fim de quem ficou 'atrasado' numa assinatura já cancelada", async () => {
    const user = usuario({ planStatus: "past_due", stripeSubscriptionId: "sub_1", planInterval: "month" });
    findById.mockResolvedValue(user);
    retrieve.mockResolvedValue({ id: "sub_1", customer: "cus_1", status: "canceled", ended_at: 1_780_000_000 });

    const r = await encerrarStatusPreso("u1", "sub_1", "past_due");

    expect(r.resultado).toBe("corrigido");
    expect(user.planStatus).toBe("canceled");
    expect(user.planExpiresAt).toEqual(new Date(1_780_000_000 * 1000));
    expect(user.planInterval).toBeUndefined();
    expect(user.save).toHaveBeenCalled();
  });

  test("não mexe se o status mudou desde a leitura", async () => {
    const user = usuario({ planStatus: "canceled", stripeSubscriptionId: "sub_1" });
    findById.mockResolvedValue(user);

    const r = await encerrarStatusPreso("u1", "sub_1", "past_due");

    expect(r).toMatchObject({ resultado: "pulado", motivo: "o status mudou desde a leitura" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(user.save).not.toHaveBeenCalled();
  });

  test("nunca tira o Pro de ninguém", async () => {
    const user = usuario({ planStatus: "active", stripeSubscriptionId: "sub_1" });
    findById.mockResolvedValue(user);

    const r = await encerrarStatusPreso("u1", "sub_1", "active");

    expect(r.resultado).toBe("pulado");
    expect(user.save).not.toHaveBeenCalled();
  });

  test("não encerra se a assinatura voltou a cobrar", async () => {
    const user = usuario({ planStatus: "past_due", stripeSubscriptionId: "sub_1" });
    findById.mockResolvedValue(user);
    retrieve.mockResolvedValue({ id: "sub_1", customer: "cus_1", status: "past_due" });

    const r = await encerrarStatusPreso("u1", "sub_1", "past_due");

    expect(r.resultado).toBe("pulado");
    expect(user.save).not.toHaveBeenCalled();
  });
});

describe("corrigirAssinaturaGravada", () => {
  test("aponta o banco para a assinatura viva que a pessoa paga", async () => {
    const user = usuario({ planStatus: "active", stripeSubscriptionId: "sub_fantasma" });
    findById.mockResolvedValue(user);
    retrieve.mockResolvedValue(assinaturaViva("active"));

    const r = await corrigirAssinaturaGravada("u1", "sub_viva");

    expect(r.resultado).toBe("corrigido");
    expect(user.stripeSubscriptionId).toBe("sub_viva");
    expect(user.save).toHaveBeenCalled();
  });

  test("não aplica se isso tirar o Pro (assinatura viva em atraso)", async () => {
    const user = usuario({ planStatus: "active", stripeSubscriptionId: "sub_fantasma" });
    findById.mockResolvedValue(user);
    retrieve.mockResolvedValue(assinaturaViva("past_due"));

    const r = await corrigirAssinaturaGravada("u1", "sub_viva");

    expect(r.resultado).toBe("pulado");
    expect(user.stripeSubscriptionId).toBe("sub_fantasma");
    expect(user.save).not.toHaveBeenCalled();
  });
});

describe("precisaAtencao", () => {
  const vazio = {
    totais: { usuarios: 1, assinaturas: 1, batem: 1 },
    pagaOutraAssinatura: [],
    cobrancaDupla: [],
    proSemAssinatura: [],
    pagaSemPro: [],
    statusDiferente: [],
    gravadaInexistente: [],
    vivaSemUsuario: [],
  };

  test("cortesias conhecidas e assinaturas que cancelam no fim não disparam e-mail diário", () => {
    const resultado = {
      conferencia: {
        ...vazio,
        proSemAssinatura: [{ userId: "u1", role: "user", planStatus: "active", planExpiresAt: null, assinatura: null }],
        vivaSemUsuario: [{ id: "sub_x", status: "active", cancelaNoFim: true, criadaEm: new Date() }],
      },
      correcoes: [],
    };
    expect(precisaAtencao(resultado as any, pendenciasHumanas(resultado as any))).toBe(false);
  });

  test("pagante sem Pro dispara", () => {
    const resultado = {
      conferencia: {
        ...vazio,
        pagaSemPro: [{ userId: "u1", planStatus: "canceled", assinatura: { id: "sub_1", status: "active", cancelaNoFim: false } }],
      },
      correcoes: [],
    };
    expect(precisaAtencao(resultado as any, pendenciasHumanas(resultado as any))).toBe(true);
  });
});
