/**
 * @jest-environment node
 */
import { ensureInvoiceIdempotent, ensureSubscriptionFirstTime } from "@/app/services/affiliate/idempotency";
import AffiliateInvoiceIndex from "@/app/models/AffiliateInvoiceIndex";
import AffiliateSubscriptionIndex from "@/app/models/AffiliateSubscriptionIndex";
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(null) }));
jest.mock("@/app/models/AffiliateInvoiceIndex", () => ({ create: jest.fn() }));
jest.mock("@/app/models/AffiliateSubscriptionIndex", () => ({ create: jest.fn() }));

describe("affiliate idempotency", () => {
  beforeEach(() => {
    (AffiliateInvoiceIndex.create as jest.Mock).mockReset();
    (AffiliateSubscriptionIndex.create as jest.Mock).mockReset();
  });

  it("ensureInvoiceIdempotent returns ok true first time and false on duplicates", async () => {
    (AffiliateInvoiceIndex.create as jest.Mock)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: 11000 });

    const r1 = await ensureInvoiceIdempotent("inv1", "u1");
    const r2 = await ensureInvoiceIdempotent("inv1", "u1");

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("duplicate");
  });

  it("ensureSubscriptionFirstTime returns ok true then false", async () => {
    (AffiliateSubscriptionIndex.create as jest.Mock)
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce({ code: 11000 });

    const r1 = await ensureSubscriptionFirstTime("sub1", "u1");
    const r2 = await ensureSubscriptionFirstTime("sub1", "u1");

    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(false);
    expect(r2.reason).toBe("already-had-commission");
  });

  it("concurrent calls allow only one invoice", async () => {
    (AffiliateInvoiceIndex.create as jest.Mock)
      .mockImplementationOnce(async () => {})
      .mockRejectedValueOnce({ code: 11000 });

    const [a, b] = await Promise.all([
      ensureInvoiceIdempotent("inv2", "u1"),
      ensureInvoiceIdempotent("inv2", "u1"),
    ]);

    const okCount = [a, b].filter((r) => r.ok).length;
    expect(okCount).toBe(1);
  });
});
