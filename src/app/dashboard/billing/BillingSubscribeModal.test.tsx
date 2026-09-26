import { fireEvent, render, screen } from "@testing-library/react";

import BillingSubscribeModal from "./BillingSubscribeModal";
import useBillingStatus from "@/app/hooks/useBillingStatus";

jest.mock("next-auth/react", () => ({ useSession: () => ({ status: "authenticated", data: { user: { id: "u1" } } }) }));
jest.mock("next/navigation", () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), refresh: jest.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
jest.mock("@/lib/track", () => ({ track: jest.fn() }));
jest.mock("@/app/hooks/useBillingStatus", () => ({ __esModule: true, default: jest.fn() }));

const billing = useBillingStatus as jest.Mock;

function status(overrides: Record<string, unknown>) {
  billing.mockReturnValue({
    isLoading: false,
    error: null,
    hasPremiumAccess: false,
    needsPaymentAction: false,
    needsCheckout: false,
    needsAbort: false,
    needsPaymentUpdate: false,
    normalizedStatus: "inactive",
    refetch: jest.fn(),
    ...overrides,
  });
}

beforeEach(() => {
  const prices = [
    { plan: "monthly", currency: "brl", unitAmount: 9700 },
    { plan: "annual", currency: "brl", unitAmount: 89000 },
    { plan: "monthly", currency: "usd", unitAmount: 1900 },
    { plan: "annual", currency: "usd", unitAmount: 17900 },
  ];
  global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ prices }) }) as unknown as typeof fetch;
});

describe("janela de assinatura para quem tem pagamento pendente", () => {
  it("pagamento atrasado: diz o motivo e o botão principal leva à página do plano", async () => {
    // Pagamento atrasado ainda pode contar como acesso ativo: o aviso de pagamento vence o "já é Pro".
    status({ needsPaymentUpdate: true, needsPaymentAction: true, hasPremiumAccess: true, normalizedStatus: "past_due" });
    const onClose = jest.fn();
    render(<BillingSubscribeModal open onClose={onClose} />);

    expect(await screen.findByText(/Seu último pagamento não passou/)).toBeTruthy();
    expect(screen.queryByText(/Você já tem o Pro ativo/)).toBeNull();
    const action = screen.getByRole("link", { name: /Atualizar pagamento/ });
    expect(action.getAttribute("href")).toBe("/dashboard/billing");
    expect(screen.queryByRole("button", { name: /Assinar/ })).toBeNull();

    fireEvent.click(action);
    expect(onClose).toHaveBeenCalled();
  });

  it("checkout pela metade: pede para resolver a pendência", async () => {
    status({ needsCheckout: true, needsPaymentAction: true, normalizedStatus: "incomplete" });
    render(<BillingSubscribeModal open onClose={jest.fn()} />);
    expect((await screen.findByRole("link", { name: /Resolver pendência/ })).getAttribute("href")).toBe("/dashboard/billing");
  });

  it("sem pendência, continua a janela de venda de sempre", async () => {
    status({});
    render(<BillingSubscribeModal open onClose={jest.fn()} />);
    expect(await screen.findByText("Pagamento seguro. Cancele quando quiser.")).toBeTruthy();
    expect(screen.queryByRole("link", { name: /Atualizar pagamento|Resolver pendência/ })).toBeNull();
  });
});
