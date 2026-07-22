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
    expect(screen.getByText("Conecte o Instagram primeiro")).toBeInTheDocument();
    expect(
      screen.queryByTestId("whatsapp-connection-control"),
    ).not.toBeInTheDocument();
  });

  it("mostra Instagram e vinculação do WhatsApp no mesmo hub para assinantes Pro", () => {
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
    expect(screen.getByTestId("whatsapp-connection-control")).toBeInTheDocument();
    expect(screen.getByText("Controle de vinculação do WhatsApp")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Abrir Chat AI" })).toHaveAttribute(
      "href",
      "/dashboard/chat",
    );
  });

  it("mantém o Instagram conectado e apresenta o Plano Pro para liberar alertas", () => {
    mockInstagram({
      ...disconnectedStatus,
      isConnected: true,
      username: "conta_teste",
    });
    mockBilling();

    render(<InstagramConnectionPage />);

    expect(screen.getByText("Sincronização Ativa")).toBeInTheDocument();
    expect(screen.getByText("Plano Pro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver Plano Pro" })).toHaveAttribute(
      "href",
      "/pro",
    );
    expect(
      screen.queryByTestId("whatsapp-connection-control"),
    ).not.toBeInTheDocument();
  });
});
