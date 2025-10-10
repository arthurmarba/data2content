jest.mock("next-auth/jwt", () => ({
  getToken: jest.fn(),
}));

jest.mock("jose", () => ({
  jwtVerify: jest.fn(),
}));

import {
  ensurePlannerAccess,
  getPlanGuardMetrics,
  isActiveLike,
  normalizePlanStatus,
  resetPlanGuardMetrics,
} from "@/app/lib/planGuard";
import { connectToDatabase } from "@/app/lib/mongoose";
import DbUser from "@/app/models/User";

jest.mock("@/app/lib/mongoose", () => ({
  connectToDatabase: jest.fn(),
}));

jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    findOne: jest.fn(),
  },
}));

describe("planGuard helpers", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    resetPlanGuardMetrics();
  });

  it("normalizes plan status and detects active-like values", () => {
    expect(normalizePlanStatus(" Trialing  ")).toBe("trialing");
    expect(normalizePlanStatus("non-renewing")).toBe("non_renewing");
    expect(isActiveLike("trial")).toBe(true);
    expect(isActiveLike("inactive")).toBe(false);
  });

  it("short-circuits when session already has active status", async () => {
    const result = await ensurePlannerAccess({
      session: {
        user: { id: "user-123", planStatus: "active" },
      } as any,
    });

    expect(result.ok).toBe(true);
    expect((connectToDatabase as jest.Mock)).not.toHaveBeenCalled();
  });

  it("consults database when session status is inactive", async () => {
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
    (DbUser.findOne as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ planStatus: "trialing" }),
    }));

    const result = await ensurePlannerAccess({
      session: {
        user: { id: "user-123", email: "test@example.com", planStatus: "inactive" },
      } as any,
      routePath: "/api/planner/plan",
    });

    expect(connectToDatabase).toHaveBeenCalled();
    expect(DbUser.findOne).toHaveBeenCalledWith({ email: "test@example.com" });
    expect(result.ok).toBe(true);
  });

  it("blocks when database returns non-active status", async () => {
    (connectToDatabase as jest.Mock).mockResolvedValue(undefined);
    (DbUser.findOne as jest.Mock).mockImplementation(() => ({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue({ planStatus: "inactive" }),
    }));

    const result = await ensurePlannerAccess({
      session: {
        user: { email: "test@example.com", planStatus: "inactive" },
      } as any,
      routePath: "/api/planner/plan",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(403);
      expect(result.reason).toBe("inactive");
    }
    expect(getPlanGuardMetrics().blocked).toBe(1);
  });
});
