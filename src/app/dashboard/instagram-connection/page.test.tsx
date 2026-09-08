import { render, screen } from "@testing-library/react";
import useBillingStatus from "@/app/hooks/useBillingStatus";
import useInstagramStatus from "@/app/hooks/useInstagramStatus";
import InstagramConnectionPage from "./page";

jest.mock("@/app/hooks/useInstagramStatus", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/app/hooks/useBillingStatus", () => ({
  __esModule: true,
  default: jest.fn(),
}));

jest.mock("@/app/components/ui/ToastA11yProvider", () => ({
  useToast: () => ({ toast: jest.fn() }),
}));

jest.mock("@/app/dashboard/WhatsAppConnectInline", () => ({
  __esModule: true,
  default: () => <div>Controle de vinculação do WhatsApp</div>,
}));

const mockedUseInstagramStatus = useInstagramStatus as jest.Mock;
const mockedUseBillingStatus = useBillingStatus as jest.Mock;

const disconnectedStatus = {
  isConnected: false,
  username: null,
  profilePictureUrl: null,
  pageName: null,
};

function mockInstagram(status = disconnectedStatus) {
  mockedUseInstagramStatus.mockReturnValue({
    status,
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  });
}

function mockBilling({
  hasPremiumAccess = false,
  isLoading = false,
}: {
  hasPremiumAccess?: boolean;
  isLoading?: boolean;
} = {}) {
  mockedUseBillingStatus.mockReturnValue({
    hasPremiumAccess,
    isLoading,
  });
}

describe("InstagramConnectionPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("leva a conexão do Instagram para a tela explicativa antes do OAuth", () => {
    mockInstagram();
    mockBilling();

    render(<InstagramConnectionPage />);

    expect(screen.getByRole("heading", { name: "Conexões" })).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Revisar e conectar com a Meta/i }),
    ).toHaveAttribute(
      "href",
      "/dashboard/instagram/connect?next=instagram-connection",
    );
    expect(screen.queryByText("Alertas no WhatsApp")).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("whatsapp-connection-control"),
    ).not.toBeInTheDocument();
  });

  it("mantém Instagram e oculta vinculação e alertas para assinantes Pro", () => {
    mockInstagram({
      ...disconnectedStatus,
      isConnected: true,
      username: "conta_teste",
      pageName: "Conta de Teste",
    });
    mockBilling({ hasPremiumAccess: true });

    render(<InstagramConnectionPage />);

    expect(screen.getByText("Sincronização Ativa")).toBeInTheDocument();
    expect(screen.getByText("@conta_teste")).toBeInTheDocument();
    expect(screen.queryByTestId("whatsapp-connection-control")).not.toBeInTheDocument();
    expect(screen.queryByText(/WhatsApp/)).not.toBeInTheDocument();
  });

  it("mantém o Instagram conectado sem oferecer alertas no plano gratuito", () => {
    mockInstagram({
      ...disconnectedStatus,
      isConnected: true,
      username: "conta_teste",
    });
    mockBilling();

    render(<InstagramConnectionPage />);

    expect(screen.getByText("Sincronização Ativa")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Ver Plano Pro" })).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("whatsapp-connection-control"),
    ).not.toBeInTheDocument();
  });
});
