/** @jest-environment node */
import { NextRequest } from "next/server";
import { Receiver } from "@upstash/qstash";
import User from "@/app/models/User";
import { deleteAccountData } from "@/app/lib/account/accountDataDeletion";
import { POST } from "./route";

jest.mock("@upstash/qstash", () => ({ Receiver: jest.fn() }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn(async () => undefined) }));
jest.mock("@/app/models/User", () => ({ exists: jest.fn() }));
jest.mock("@/app/lib/account/accountDataDeletion", () => ({ deleteAccountData: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const userId = "507f1f77bcf86cd799439011";
const request = (body: unknown) =>
  new NextRequest("http://localhost/api/worker/delete-account-data", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "upstash-signature": "assinatura" },
  });
const signature = (valid: boolean) =>
  (Receiver as unknown as jest.Mock).mockImplementation(() => ({ verify: jest.fn(async () => valid) }));

beforeEach(() => {
  jest.clearAllMocks();
  process.env.QSTASH_CURRENT_SIGNING_KEY = "a";
  process.env.QSTASH_NEXT_SIGNING_KEY = "b";
  signature(true);
  (User.exists as jest.Mock).mockResolvedValue(null);
  (deleteAccountData as jest.Mock).mockResolvedValue({ collections: { "metrics.user": 3 }, files: 1 });
});

describe("POST /api/worker/delete-account-data", () => {
  it("recusa chamada sem assinatura da fila", async () => {
    signature(false);
    expect((await POST(request({ userId }))).status).toBe(401);
    expect(deleteAccountData).not.toHaveBeenCalled();
  });

  it("nunca apaga dados de uma conta que ainda existe", async () => {
    (User.exists as jest.Mock).mockResolvedValue({ _id: userId });
    expect((await POST(request({ userId }))).status).toBe(409);
    expect(deleteAccountData).not.toHaveBeenCalled();
  });

  it("recusa id inválido", async () => {
    expect((await POST(request({ userId: "x" }))).status).toBe(400);
  });

  it("apaga os dados da conta excluída", async () => {
    const res = await POST(request({ userId }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ collections: { "metrics.user": 3 }, files: 1 });
    expect(deleteAccountData).toHaveBeenCalledWith(userId);
  });

  it("devolve 503 para a fila tentar de novo quando falha", async () => {
    (deleteAccountData as jest.Mock).mockRejectedValue(new Error("timeout"));
    expect((await POST(request({ userId }))).status).toBe(503);
  });
});
