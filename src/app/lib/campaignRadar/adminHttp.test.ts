/** @jest-environment node */
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth/next";
import UserModel from "@/app/models/User";
import { radarAdminRequest } from "./adminHttp";
jest.mock("next-auth/next", () => ({ __esModule: true, default: jest.fn(() => jest.fn()), getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }));
jest.mock("@/app/models/User", () => ({ __esModule: true, default: { exists: jest.fn() } }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
describe("acesso à caixa administrativa", () => {
  const handler = jest.fn(async () => ({ private: "conteúdo" }));
  beforeEach(() => { jest.clearAllMocks(); (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "507f1f77bcf86cd799439011", role: "admin" } }); (UserModel.exists as jest.Mock).mockResolvedValue({ _id: "admin" }); });
  it("recusa visitante antes do serviço", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const response = await radarAdminRequest(new NextRequest("https://data2content.ai/api/admin/campaign-radar"), handler);
    expect(response.status).toBe(403); expect(handler).not.toHaveBeenCalled();
  });
  it("recusa administrador removido do banco", async () => {
    (UserModel.exists as jest.Mock).mockResolvedValue(null);
    expect((await radarAdminRequest(new NextRequest("https://data2content.ai/api/admin/campaign-radar"), handler)).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("recusa escrita de outra origem", async () => {
    expect((await radarAdminRequest(new NextRequest("https://data2content.ai/api/admin/campaign-radar", { method: "POST", headers: { origin: "https://other.test" } }), handler)).status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });
  it("permite escrita autenticada com cache desabilitado", async () => {
    const response = await radarAdminRequest(new NextRequest("https://data2content.ai/api/admin/campaign-radar", { method: "POST", headers: { origin: "https://data2content.ai" } }), handler);
    expect(response.status).toBe(200); expect(handler).toHaveBeenCalledWith("507f1f77bcf86cd799439011"); expect(response.headers.get("cache-control")).toBe("no-store");
  });
});
