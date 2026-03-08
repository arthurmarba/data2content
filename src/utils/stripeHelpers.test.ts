/** @jest-environment node */

jest.mock("@/app/models/User", () => ({ findById: jest.fn() }));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    customers: {
      retrieve: jest.fn(),
      create: jest.fn(),
    },
    subscriptions: {
      list: jest.fn(),
      cancel: jest.fn(),
    },
  },
}));

const { stripe } = require("@/app/lib/stripe");
const {
  applyStaleStripeBillingPatch,
  getOrCreateStripeCustomerId,
  isStripeResourceMissingError,
} = require("./stripeHelpers");

const mockCustomerRetrieve = (stripe as any).customers.retrieve as jest.Mock;
const mockCustomerCreate = (stripe as any).customers.create as jest.Mock;

beforeEach(() => {
  jest.clearAllMocks();
});

describe("stripeHelpers", () => {
  it("detects missing Stripe customer errors", () => {
    expect(
      isStripeResourceMissingError(
        {
          code: "resource_missing",
          param: "customer",
          type: "StripeInvalidRequestError",
          message: "No such customer: 'cus_dead'",
        },
        "customer"
      )
    ).toBe(true);
  });

  it("applies stale billing reset without clearing customer when requested", () => {
    const user: any = {
      stripeCustomerId: "cus_123",
      stripeSubscriptionId: "sub_123",
      stripePriceId: "price_123",
      planStatus: "active",
      planInterval: "month",
      planExpiresAt: new Date(),
      currentPeriodEnd: new Date(),
      cancelAtPeriodEnd: true,
    };

    applyStaleStripeBillingPatch(user, { clearCustomerId: false });

    expect(user.stripeCustomerId).toBe("cus_123");
    expect(user.stripeSubscriptionId).toBeNull();
    expect(user.planStatus).toBe("inactive");
    expect(user.cancelAtPeriodEnd).toBe(false);
  });

  it("recreates the customer when the saved Stripe customer no longer exists", async () => {
    const user: any = {
      _id: "u1",
      email: "u1@test.com",
      name: "User One",
      stripeCustomerId: "cus_old",
      save: jest.fn().mockResolvedValue(undefined),
    };

    mockCustomerRetrieve.mockRejectedValue({
      code: "resource_missing",
      param: "customer",
      type: "StripeInvalidRequestError",
      message: "No such customer: 'cus_old'",
    });
    mockCustomerCreate.mockResolvedValue({ id: "cus_new" });

    await expect(getOrCreateStripeCustomerId(user)).resolves.toBe("cus_new");
    expect(user.stripeCustomerId).toBe("cus_new");
    expect(mockCustomerCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        email: "u1@test.com",
        name: "User One",
        metadata: { userId: "u1" },
      }),
      expect.objectContaining({ idempotencyKey: "user-u1-customer" })
    );
    expect(user.save).toHaveBeenCalledTimes(2);
  });
});
