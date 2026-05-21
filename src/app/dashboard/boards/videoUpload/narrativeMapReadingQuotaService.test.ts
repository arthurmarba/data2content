import { Types } from "mongoose";
import { connectToDatabase } from "@/app/lib/mongoose";
import {
  assertCanStartNarrativeMapReading,
  getNarrativeMapReadingQuotaForUser,
} from "./narrativeMapReadingQuotaService";

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

function mockModel(counts: number[]) {
  return {
    countDocuments: jest.fn()
      .mockResolvedValueOnce(counts[0] ?? 0)
      .mockResolvedValueOnce(counts[1] ?? 0),
  } as any;
}

describe("narrativeMapReadingQuotaService", () => {
  const userId = new Types.ObjectId().toString();
  const now = new Date("2026-05-21T12:00:00.000Z");

  beforeEach(() => {
    jest.clearAllMocks();
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
  });

  it("calcula quota por userId e mês atual", async () => {
    const model = mockModel([3, 2]);
    const quota = await getNarrativeMapReadingQuotaForUser({ userId, now, model });

    expect(quota).toMatchObject({
      userId,
      monthKey: "2026-05",
      usedTotal: 3,
      usedThisMonth: 2,
      freeTotalLimit: 1,
      proMonthlyLimit: 10,
    });
    expect(model.countDocuments).toHaveBeenNthCalledWith(1, {
      userId: new Types.ObjectId(userId),
      status: "completed",
    });
    expect(model.countDocuments).toHaveBeenNthCalledWith(2, {
      userId: new Types.ObjectId(userId),
      status: "completed",
      createdAt: {
        $gte: new Date("2026-05-01T00:00:00.000Z"),
        $lt: new Date("2026-06-01T00:00:00.000Z"),
      },
    });
  });

  it("Free pode iniciar primeira leitura e bloqueia segunda", async () => {
    await expect(assertCanStartNarrativeMapReading({
      userId,
      now,
      model: mockModel([0, 0]),
      access: {},
    })).resolves.toMatchObject({ ok: true, state: "free_unused" });

    await expect(assertCanStartNarrativeMapReading({
      userId,
      now,
      model: mockModel([1, 1]),
      access: {},
    })).resolves.toMatchObject({ ok: false, state: "free_preview_used" });
  });

  it("Pro pode iniciar até 10 por mês e bloqueia 11ª", async () => {
    await expect(assertCanStartNarrativeMapReading({
      userId,
      now,
      model: mockModel([20, 9]),
      access: { hasPremiumAccess: true, instagram: { connected: true } },
    })).resolves.toMatchObject({ ok: true, state: "pro_instagram_connected" });

    await expect(assertCanStartNarrativeMapReading({
      userId,
      now,
      model: mockModel([20, 10]),
      access: { hasPremiumAccess: true, instagram: { connected: true } },
    })).resolves.toMatchObject({ ok: false, state: "pro_quota_reached" });
  });

  it("não permite contagem de outro userId", async () => {
    const model = mockModel([0, 0]);
    await getNarrativeMapReadingQuotaForUser({ userId, now, model });
    const serializedQueries = JSON.stringify(model.countDocuments.mock.calls);

    expect(serializedQueries).toContain(userId);
    expect(serializedQueries).not.toContain(new Types.ObjectId().toString());
  });
});
