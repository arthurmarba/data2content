import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { DiagnosticoAffiliateView } from "./DiagnosticoAffiliateView";
import { useAffiliateDashboard } from "@/hooks/useAffiliateDashboard";

jest.mock("@/hooks/useAffiliateDashboard", () => ({
  formatAffiliateAmount: (amountCents: number, currency: string) =>
    `${currency} ${(amountCents / 100).toFixed(2)}`,
  useAffiliateDashboard: jest.fn(),
}));

jest.mock("@/lib/track", () => ({ track: jest.fn() }));

jest.mock("lucide-react", () => {
  const ReactForMock = require("react");
  const Icon = (props: Record<string, unknown>) => ReactForMock.createElement("svg", props);
  return new Proxy({}, { get: () => Icon });
});

const mockUseAffiliateDashboard = useAffiliateDashboard as jest.MockedFunction<typeof useAffiliateDashboard>;

function dashboard(overrides: Record<string, unknown> = {}) {
  return {
    summary: { byCurrency: { BRL: {} } },
    status: {
      payoutsEnabled: false,
      needsOnboarding: true,
      isUnderReview: false,
      defaultCurrency: "BRL",
      disabledReasonKey: null,
      accountCountry: "BR",
      lastRefreshedAt: "2026-07-22T00:00:00.000Z",
    },
    loading: false,
    error: null,
    refreshing: false,
    connecting: false,
    redeeming: false,
    affiliateCode: "LIVIA123",
    referralLink: "https://data2content.ai/?ref=LIVIA123",
    copiedKind: null,
    a11yMessage: "",
    primaryCurrency: "BRL",
    currencySummary: {
      availableCents: 12500,
      storedAvailableCents: 12500,
      reconciliationStatus: "reconciled",
      pendingCents: 3200,
      debtCents: 0,
      nextMatureAt: "2026-07-30T00:00:00.000Z",
      minRedeemCents: 5000,
      activeRedemption: null,
    },
    availableCents: 12500,
    pendingCents: 3200,
    totalCents: 15700,
    minRedeemCents: 5000,
    debtCents: 0,
    blockReason: "needsOnboarding",
    redeemEnabled: false,
    refresh: jest.fn(),
    copy: jest.fn(),
    share: jest.fn(),
    openStripe: jest.fn(),
    redeem: jest.fn(),
    ...overrides,
  } as ReturnType<typeof useAffiliateDashboard>;
}

describe("DiagnosticoAffiliateView", () => {
  it("mostra saldo, link e CTA de conexão Stripe", () => {
    const state = dashboard();
    mockUseAffiliateDashboard.mockReturnValue(state);

    render(<DiagnosticoAffiliateView onBack={jest.fn()} onClose={jest.fn()} />);

    expect(screen.getByText("BRL 125.00")).toBeInTheDocument();
    expect(screen.getByText("https://data2content.ai/?ref=LIVIA123")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Conectar Stripe" }));
    expect(state.openStripe).toHaveBeenCalledTimes(1);
  });

  it("confirma o recebimento quando o saldo está elegível", async () => {
    const state = dashboard({
      status: {
        payoutsEnabled: true,
        needsOnboarding: false,
        isUnderReview: false,
        defaultCurrency: "BRL",
      },
      blockReason: null,
      redeemEnabled: true,
      redeem: jest.fn().mockResolvedValue(true),
    });
    mockUseAffiliateDashboard.mockReturnValue(state);

    render(<DiagnosticoAffiliateView onBack={jest.fn()} onClose={jest.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "Receber agora" }));
    expect(screen.getByText("Receber BRL 125.00?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Confirmar" }));
    await waitFor(() => expect(state.redeem).toHaveBeenCalledTimes(1));
  });

  it("usa atualizar status enquanto o cadastro está em análise", () => {
    const state = dashboard({
      status: {
        payoutsEnabled: false,
        needsOnboarding: false,
        isUnderReview: true,
        defaultCurrency: "BRL",
      },
      blockReason: "payouts_disabled",
    });
    mockUseAffiliateDashboard.mockReturnValue(state);

    render(<DiagnosticoAffiliateView onBack={jest.fn()} onClose={jest.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "Atualizar status" }));
    expect(state.refresh).toHaveBeenCalledTimes(1);
  });
});
