import { BILLING_PAGE_ROUTE, resolvePaymentBlock } from "./paymentBlock";

describe("resolvePaymentBlock", () => {
  it("pagamento atrasado: pede para atualizar o pagamento, na página do plano", () => {
    expect(resolvePaymentBlock({ needsPaymentUpdate: true })).toEqual(
      expect.objectContaining({ actionLabel: "Atualizar pagamento", href: BILLING_PAGE_ROUTE }),
    );
  });

  it("checkout começado e não concluído: pede para resolver a pendência", () => {
    expect(resolvePaymentBlock({ needsCheckout: true })).toEqual(
      expect.objectContaining({ actionLabel: "Resolver pendência", href: BILLING_PAGE_ROUTE }),
    );
  });

  it("sem pendência, a janela segue vendendo normalmente", () => {
    expect(resolvePaymentBlock({})).toBeNull();
  });

  it("enquanto carrega ou se o status falhou, não afirma nada", () => {
    expect(resolvePaymentBlock({ loading: true, needsPaymentUpdate: true })).toBeNull();
    expect(resolvePaymentBlock({ error: new Error("x"), needsPaymentUpdate: true })).toBeNull();
  });
});
