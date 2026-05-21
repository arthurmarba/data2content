import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useSession } from "next-auth/react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import { fetchHomeSummaryCached } from "@/app/dashboard/home/homeSummaryClient";
import CommunityConversionSection from "./CommunityConversionSection";
import { trackMobileNarrativeEvent } from "@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry";

jest.mock("next-auth/react", () => ({
  useSession: jest.fn(),
}));

jest.mock("@/app/hooks/useBillingStatus", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/app/dashboard/home/homeSummaryClient", () => ({
  fetchHomeSummaryCached: jest.fn(),
}));

jest.mock("@/app/dashboard/boards/videoUpload/mobileNarrativeTelemetry", () => ({
  trackMobileNarrativeEvent: jest.fn(),
}));

jest.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => <div {...props}>{children}</div>,
    section: ({ children, ...props }: React.HTMLAttributes<HTMLElement>) => <section {...props}>{children}</section>,
  },
}));

const mockedUseSession = useSession as jest.Mock;
const mockedUseBillingStatus = useBillingStatus as jest.Mock;
const mockedFetchHomeSummaryCached = fetchHomeSummaryCached as jest.Mock;

function mockBilling(overrides: Partial<ReturnType<typeof useBillingStatus>> = {}) {
  mockedUseBillingStatus.mockReturnValue({
    hasPremiumAccess: false,
    needsCheckout: false,
    needsPaymentAction: false,
    ...overrides,
  });
}

describe("CommunityConversionSection", () => {
  beforeEach(() => {
    mockedUseSession.mockReturnValue({ status: "authenticated" });
    mockedFetchHomeSummaryCached.mockResolvedValue({
      community: {
        free: { isMember: true, inviteUrl: null },
        vip: { hasAccess: true, isMember: false, inviteUrl: "https://chat.whatsapp.com/vip", joinedAt: null, needsJoinReminder: true },
      },
      mentorship: { nextSessionLabel: "quinta, 19h" },
    });
    jest.spyOn(window, "dispatchEvent");
    jest.spyOn(window, "open").mockImplementation(() => null);
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
  });

  it("mostra banner compacto de consultoria para Free e abre paywall de mentoria", async () => {
    mockBilling();

    render(<CommunityConversionSection />);

    expect(screen.getByText("Consultoria em grupo")).toBeInTheDocument();
    expect(screen.getByText("Assine o Pro para entrar no Grupo VIP da D2C.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Assinar e entrar/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Assinar e entrar/i }));

    expect(window.dispatchEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "open-subscribe-modal",
        detail: expect.objectContaining({
          context: "mentoria",
          source: "community_mentoria",
          postCheckoutIntent: "join_community",
        }),
      }),
    );
    expect(trackMobileNarrativeEvent).toHaveBeenCalledWith(
      "mobile_community_action_clicked",
      expect.objectContaining({
        actionType: "open_paywall",
        paywallContext: "mentoria",
        postCheckoutIntent: "join_community",
      }),
    );
  });

  it("mostra acesso direto para Pro sem pitch longo de assinatura", async () => {
    mockBilling({ hasPremiumAccess: true });

    render(<CommunityConversionSection />);

    expect(screen.getByText("Grupo VIP liberado")).toBeInTheDocument();
    expect(screen.getByText("via WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Entrar" })).toBeInTheDocument();
    expect(screen.queryByText("Consultoria em grupo")).not.toBeInTheDocument();

    await waitFor(() => expect(screen.getByText("Próxima consultoria: quinta, 19h")).toBeInTheDocument());
  });

  it("mostra acao segura para pagamento pendente", () => {
    mockBilling({ needsCheckout: true });

    render(<CommunityConversionSection />);

    expect(screen.getByText("Finalize seu Plano Pro")).toBeInTheDocument();
    expect(screen.getByText("Conclua o pagamento para liberar consultoria, Instagram e 10 leituras por mês.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Continuar pagamento/i })).toBeInTheDocument();
  });
});
