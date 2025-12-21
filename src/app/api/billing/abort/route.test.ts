/** @jest-environment node */
import "next/dist/server/node-polyfill-fetch";
import { NextRequest } from "next/server";

jest.mock("next-auth", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/[...nextauth]/route", () => ({ authOptions: {} }), { virtual: true });
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/User", () => ({ findById: jest.fn() }));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    subscriptions: {
      retrieve: jest.fn(),
      cancel: jest.fn(),
      list: jest.fn(),
    },
  },
}));
jest.mock("@/utils/stripeHelpers", () => ({ cancelBlockingIncompleteSubs: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const getServerSession = require("next-auth").getServerSession as jest.Mock;
const { connectToDatabase } = require("@/app/lib/mongoose");
const User = require("@/app/models/User");
const { stripe } = require("@/app/lib/stripe");
const { cancelBlockingIncompleteSubs } = require("@/utils/stripeHelpers");
const { POST } = require("./route");

const mockGetServerSession = getServerSession as jest.Mock;
const mockConnect = connectToDatabase as jest.Mock;
const mockFindById = (User as any).findById as jest.Mock;
const mockRetrieve = (stripe as any).subscriptions.retrieve as jest.Mock;
const mockCancel = (stripe as any).subscriptions.cancel as jest.Mock;
const mockList = (stripe as any).subscriptions.list as jest.Mock;
const mockCancelBlocking = cancelBlockingIncompleteSubs as jest.Mock;

const createRequest = (body: any) =>
  new NextRequest("http://localhost/api/billing/abort", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });

beforeEach(() => {
  jest.clearAllMocks();
  mockConnect.mockResolvedValue(undefined);
});

describe("POST /api/billing/abort", () => {
  it("clears pending subscription and resets DB", async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: "u1" } });
    const user: any = {
      _id: "u1",
      stripeCustomerId: "cus_1",
      stripeSubscriptionId: "sub_1",
      stripePriceId: "price_1",
      planInterval: "month",
      planExpiresAt: new Date(),
      cancelAtPeriodEnd: true,
      planStatus: "pending",
      save: jest.fn(),
    };
    mockFindById.mockResolvedValue(user);
    mockRetrieve.mockResolvedValue({ id: "sub_1", status: "incomplete" });
    mockCancel.mockResolvedValue({});
    mockCancelBlocking.mockResolvedValue({ canceled: ["sub_1"], skipped: [] });
    mockList.mockResolvedValue({ data: [] });

    const res = await POST(createRequest({ subscriptionId: "sub_1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(user.planStatus).toBe("inactive");
    expect(user.stripeSubscriptionId).toBeNull();
    expect(user.stripePriceId).toBeNull();
    expect(user.planInterval).toBeNull();
    expect(user.planExpiresAt).toBeNull();
    expect(user.cancelAtPeriodEnd).toBe(false);
    expect(user.save).toHaveBeenCalled();
  });
});
