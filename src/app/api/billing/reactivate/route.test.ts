/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }), { virtual: true });
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ findById: jest.fn() }));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
      update: jest.fn(),
    },
  },
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const getServerSession = require("next-auth/next").getServerSession as jest.Mock;
const { connectToDatabase } = require("@/app/lib/mongoose");
const User = require("@/app/models/User");
const { stripe } = require("@/app/lib/stripe");
const { POST } = require("./route");

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (User as any).findById as jest.Mock;
const mockRetrieve = (stripe as any).subscriptions.retrieve as jest.Mock;
const mockUpdate = (stripe as any).subscriptions.update as jest.Mock;

const createRequest = () => new NextRequest("http://localhost/api/billing/reactivate", { method: "POST" });

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe("POST /api/billing/reactivate", () => {
  it("reactivates when cancel_at_period_end is true", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
    const save = jest.fn();
    mockFindById.mockResolvedValue({ _id: "u1", stripeSubscriptionId: "sub_1", save });
    mockRetrieve.mockResolvedValue({
      id: "sub_1",
      status: "active",
      cancel_at_period_end: true,
      current_period_end: 1700000000,
      items: { data: [{ price: { id: "price_1", recurring: { interval: "month" } } }] },
    });
    mockUpdate.mockResolvedValue({
      id: "sub_1",
      status: "active",
      cancel_at_period_end: false,
      current_period_end: 1700000000,
      items: { data: [{ price: { id: "price_1", recurring: { interval: "month" } } }] },
    });

    const res = await POST(createRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(save).toHaveBeenCalled();
  });

  it("blocks when subscription is canceled", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
    const save = jest.fn();
    mockFindById.mockResolvedValue({ _id: "u1", stripeSubscriptionId: "sub_1", save });
    mockRetrieve.mockResolvedValue({
      id: "sub_1",
      status: "canceled",
      cancel_at_period_end: false,
      items: { data: [{ price: { id: "price_1", recurring: { interval: "month" } } }] },
    });

    const res = await POST(createRequest());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.code).toBe("NOT_REACTIVATABLE_USE_SUBSCRIBE");
    expect(mockUpdate).not.toHaveBeenCalled();
    expect(save).toHaveBeenCalled();
  });
});
