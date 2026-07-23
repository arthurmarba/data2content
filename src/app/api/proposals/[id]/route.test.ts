/** @jest-environment node */
import { NextRequest } from "next/server";
import mongoose from "mongoose";

import BrandProposal from "@/app/models/BrandProposal";
import { PATCH } from "./route";

jest.mock("next-auth/next", () => ({ getServerSession: jest.fn() }));
jest.mock("@/app/api/auth/resolveAuthOptions", () => ({
  resolveAuthOptions: jest.fn().mockResolvedValue({}),
}));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/models/BrandProposal", () => ({
  __esModule: true,
  default: {
    findById: jest.fn(),
    updateOne: jest.fn(),
  },
}));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), error: jest.fn(), warn: jest.fn() },
}));

const getServerSessionMock = require("next-auth/next").getServerSession as jest.Mock;
const brandProposalModel = BrandProposal as any;
const proposalId = new mongoose.Types.ObjectId();
const userId = new mongoose.Types.ObjectId();

function queryResult(value: any) {
  return {
    lean: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue(value),
  };
}

describe("PATCH /api/proposals/[id]", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-07-23T18:00:00.000Z"));
    jest.clearAllMocks();
    getServerSessionMock.mockResolvedValue({ user: { id: userId.toString() } });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("marca openedAt e move uma proposta nova para visto", async () => {
    const proposal = {
      _id: proposalId,
      userId,
      brandName: "Marca",
      campaignTitle: "Campanha",
      contactEmail: "marca@example.com",
      status: "novo",
      openedAt: null,
      createdAt: new Date("2026-07-23T17:00:00.000Z"),
      updatedAt: new Date("2026-07-23T17:00:00.000Z"),
    };
    const openedAt = new Date("2026-07-23T18:00:00.000Z");
    const updated = { ...proposal, status: "visto", openedAt };

    brandProposalModel.findById
      .mockReturnValueOnce(queryResult(proposal))
      .mockReturnValueOnce(queryResult(updated));
    brandProposalModel.updateOne.mockReturnValue({
      exec: jest.fn().mockResolvedValue({ modifiedCount: 1 }),
    });

    const request = new NextRequest(
      `http://localhost/api/proposals/${proposalId.toString()}`,
      {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ opened: true }),
      },
    );
    const response = await PATCH(request, {
      params: { id: proposalId.toString() },
    });
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(brandProposalModel.updateOne).toHaveBeenCalledWith(
      { _id: proposalId },
      { $set: { openedAt, status: "visto" } },
    );
    expect(payload.openedAt).toBe(openedAt.toISOString());
    expect(payload.isUnread).toBe(false);
  });
});
