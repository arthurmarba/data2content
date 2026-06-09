import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { DiagnosticoAccountMenuSheet } from "./DiagnosticoAccountMenuSheet";
import type { DiagnosticoUserInfo } from "@/app/dashboard/boards/videoUpload/diagnosticoPageData";

// Mocka o DeleteAccountSection (puxa next-auth + fetch) — fora do escopo do menu.
jest.mock("@/app/dashboard/settings/DeleteAccountSection", () => ({
  __esModule: true,
  default: () => <div data-testid="delete-account" />,
}));

const userInfo: DiagnosticoUserInfo = {
  name: "Lívia",
  email: "livia@example.com",
  handle: "livia",
  imageUrl: null,
  plan: "Free",
};

function setup(overrides: Partial<React.ComponentProps<typeof DiagnosticoAccountMenuSheet>> = {}) {
  const props = {
    userInfo,
    isPro: false,
    instagramConnected: false,
    onClose: jest.fn(),
    onOpenMediaKit: jest.fn(),
    onOpenCommunity: jest.fn(),
    onOpenInstagramConnection: jest.fn(),
    onOpenBilling: jest.fn(),
    onUpgrade: jest.fn(),
    onOpenAffiliates: jest.fn(),
    onSignOut: jest.fn(),
    ...overrides,
  };
  render(<DiagnosticoAccountMenuSheet {...props} />);
  return props;
}

describe("DiagnosticoAccountMenuSheet — U5 menu contextual", () => {
  it("FREE: mostra 'Assinar Pro' e dispara onUpgrade (sem 'Minha assinatura')", () => {
    const props = setup({ isPro: false });
    const cta = screen.getByText("Assinar Pro");
    expect(screen.queryByText("Minha assinatura")).not.toBeInTheDocument();
    fireEvent.click(cta);
    expect(props.onUpgrade).toHaveBeenCalledTimes(1);
    expect(props.onOpenBilling).not.toHaveBeenCalled();
  });

  it("PRO: mostra 'Minha assinatura' e dispara onOpenBilling (sem 'Assinar Pro')", () => {
    const props = setup({ isPro: true, userInfo: { ...userInfo, plan: "Pro" } });
    const cta = screen.getByText("Minha assinatura");
    expect(screen.queryByText("Assinar Pro")).not.toBeInTheDocument();
    fireEvent.click(cta);
    expect(props.onOpenBilling).toHaveBeenCalledTimes(1);
    expect(props.onUpgrade).not.toHaveBeenCalled();
  });

  it("Instagram não conectado: rótulo 'Conectar Instagram'", () => {
    const props = setup({ instagramConnected: false });
    const item = screen.getByText("Conectar Instagram");
    fireEvent.click(item);
    expect(props.onOpenInstagramConnection).toHaveBeenCalledTimes(1);
  });

  it("Instagram conectado: rótulo 'Instagram conectado'", () => {
    setup({ instagramConnected: true });
    expect(screen.getByText("Instagram conectado")).toBeInTheDocument();
    expect(screen.queryByText("Conectar Instagram")).not.toBeInTheDocument();
  });

  it("Comunidade dispara onOpenCommunity", () => {
    const props = setup();
    fireEvent.click(screen.getByText("Comunidade"));
    expect(props.onOpenCommunity).toHaveBeenCalledTimes(1);
  });
});
