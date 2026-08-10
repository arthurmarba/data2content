/** @jest-environment node */
import { NextRequest } from "next/server";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }), { virtual: true });
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ findById: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/utils/rateLimit", () => ({ checkRateLimit: jest.fn() }));
jest.mock("@/app/lib/billing/syncTaxIdToStripe", () => ({ syncTaxIdToStripe: jest.fn() }));

const { getServerSession } = require("next-auth/next");
const User = require("@/app/models/User");
const { checkRateLimit } = require("@/utils/rateLimit");
const { syncTaxIdToStripe } = require("@/app/lib/billing/syncTaxIdToStripe");
const { POST, GET } = require("./route");

const CPF = "52998224725";

const createRequest = (body: unknown) =>
  new NextRequest("http://localhost/api/billing/tax-id", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  jest.clearAllMocks();
  (checkRateLimit as jest.Mock).mockResolvedValue({ allowed: true });
  (syncTaxIdToStripe as jest.Mock).mockResolvedValue(true);
  (getServerSession as jest.Mock).mockResolvedValue({ user: { id: "u1" } });
});

describe("POST /api/billing/tax-id", () => {
  it("saves a valid CPF stripped of formatting and mirrors it to Stripe", async () => {
    const save = jest.fn();
    const user = { _id: "u1", stripeCustomerId: "cus_1", save };
    (User.findById as jest.Mock).mockResolvedValue(user);

    const res = await POST(createRequest({ taxId: "529.982.247-25" }));

    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, taxIdType: "cpf" });
    expect((user as any).taxId).toBe(CPF);
    expect((user as any).taxIdType).toBe("cpf");
    expect(save).toHaveBeenCalled();
    expect(syncTaxIdToStripe).toHaveBeenCalledWith("cus_1", { value: CPF, type: "cpf" });
  });

  it("refuses a document whose check digits do not close", async () => {
    (User.findById as jest.Mock).mockResolvedValue({ _id: "u1", save: jest.fn() });

    const res = await POST(createRequest({ taxId: "123.456.789-00" }));

    expect(res.status).toBe(422);
    expect((await res.json()).code).toBe("INVALID_TAX_ID");
    expect(User.findById).not.toHaveBeenCalled();
  });

  it("still saves when Stripe sync fails — the invoice data is ours", async () => {
    const save = jest.fn();
    const user = { _id: "u1", stripeCustomerId: "cus_1", save };
    (User.findById as jest.Mock).mockResolvedValue(user);
    (syncTaxIdToStripe as jest.Mock).mockResolvedValue(false);

    const res = await POST(createRequest({ taxId: CPF }));

    expect(res.status).toBe(200);
    expect((user as any).taxId).toBe(CPF);
  });

  it("rejects an unauthenticated caller", async () => {
    (getServerSession as jest.Mock).mockResolvedValue(null);
    const res = await POST(createRequest({ taxId: CPF }));
    expect(res.status).toBe(401);
  });

  it("rate limits repeated attempts", async () => {
    (checkRateLimit as jest.Mock).mockResolvedValue({ allowed: false });
    const res = await POST(createRequest({ taxId: CPF }));
    expect(res.status).toBe(429);
  });
});

describe("GET /api/billing/tax-id", () => {
  it("reports the stored document without exposing it raw", async () => {
    (User.findById as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => ({ taxId: CPF, taxIdType: "cpf" }) }),
    });

    const res = await GET();

    expect(await res.json()).toEqual({
      hasTaxId: true,
      taxIdType: "cpf",
      taxIdMasked: "529.982.247-25",
    });
  });

  it("reports nothing stored for a user who never informed it", async () => {
    (User.findById as jest.Mock).mockReturnValue({
      select: () => ({ lean: async () => ({}) }),
    });

    expect(await (await GET()).json()).toEqual({
      hasTaxId: false,
      taxIdType: null,
      taxIdMasked: null,
    });
  });
});
