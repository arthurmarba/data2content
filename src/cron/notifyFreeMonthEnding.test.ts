/** @jest-environment node */

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));
jest.mock("@/app/lib/stripe", () => ({
  stripe: {
    subscriptions: { list: jest.fn(), update: jest.fn() },
  },
}));
jest.mock("@/app/models/User", () => ({ findById: jest.fn() }));
jest.mock("@/app/lib/emailService", () => ({ sendFreeMonthEndingEmail: jest.fn() }));

import notifyFreeMonthEnding from "./notifyFreeMonthEnding";
import { stripe } from "@/app/lib/stripe";
import { sendFreeMonthEndingEmail } from "@/app/lib/emailService";
import User from "@/app/models/User";

const DAY = 24 * 60 * 60 * 1000;

function buildSub(overrides: Record<string, any> = {}) {
  const inThreeDays = Math.floor((Date.now() + 3 * DAY) / 1000);
  return {
    id: "sub_vip",
    cancel_at_period_end: false,
    metadata: { promotionCode: "D2CVIP", userId: "u1" },
    items: {
      data: [
        {
          current_period_end: inThreeDays,
          price: { unit_amount: 9700, currency: "brl" },
        },
      ],
    },
    ...overrides,
  };
}

function mockList(subs: any[]) {
  (stripe as any).subscriptions.list.mockReturnValue({
    async *[Symbol.asyncIterator]() {
      for (const sub of subs) yield sub;
    },
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  (User as any).findById.mockReturnValue({
    select: () => ({ lean: async () => ({ email: "vip@test.com", name: "Ana Souza" }) }),
  });
  (stripe as any).subscriptions.update.mockResolvedValue({});
  (sendFreeMonthEndingEmail as jest.Mock).mockResolvedValue(undefined);
});

describe("notifyFreeMonthEnding", () => {
  it("warns the VIP subscriber three days before the first charge", async () => {
    mockList([buildSub()]);

    const result = await notifyFreeMonthEnding();

    expect(result).toMatchObject({ matched: 1, sent: 1, failed: 0 });
    expect(sendFreeMonthEndingEmail).toHaveBeenCalledWith(
      "vip@test.com",
      expect.objectContaining({ name: "Ana Souza", amountCents: 9700, currency: "BRL" }),
    );
  });

  it("ignores subscriptions that never used the coupon", async () => {
    mockList([buildSub({ metadata: { userId: "u1" } })]);

    const result = await notifyFreeMonthEnding();

    expect(result).toMatchObject({ matched: 0, sent: 0 });
    expect(sendFreeMonthEndingEmail).not.toHaveBeenCalled();
  });

  it("ignores charges that are still far away", async () => {
    mockList([
      buildSub({
        items: {
          data: [
            {
              current_period_end: Math.floor((Date.now() + 20 * DAY) / 1000),
              price: { unit_amount: 9700, currency: "brl" },
            },
          ],
        },
      }),
    ]);

    expect(await notifyFreeMonthEnding()).toMatchObject({ matched: 0, sent: 0 });
  });

  it("stays quiet for someone who already scheduled the cancellation", async () => {
    mockList([buildSub({ cancel_at_period_end: true })]);

    const result = await notifyFreeMonthEnding();

    expect(result).toMatchObject({ matched: 1, sent: 0, skipped: 1 });
    expect(sendFreeMonthEndingEmail).not.toHaveBeenCalled();
  });

  it("does not warn twice for the same charge", async () => {
    const sub = buildSub();
    sub.metadata.free_month_notice_sent_for = String(sub.items.data[0].current_period_end);
    mockList([sub]);

    const result = await notifyFreeMonthEnding();

    expect(result).toMatchObject({ sent: 0, skipped: 1 });
    expect(sendFreeMonthEndingEmail).not.toHaveBeenCalled();
  });

  it("does not mark as warned when the email failed", async () => {
    mockList([buildSub()]);
    (sendFreeMonthEndingEmail as jest.Mock).mockRejectedValue(new Error("resend caiu"));

    const result = await notifyFreeMonthEnding();

    expect(result).toMatchObject({ sent: 0, failed: 1 });
    expect((stripe as any).subscriptions.update).not.toHaveBeenCalled();
  });
});
