/* @jest-environment node */
import { NextRequest } from "next/server";
import mongoose from "mongoose";

jest.mock("@/app/lib/planGuard", () => ({ guardPremiumRequest: jest.fn().mockResolvedValue(null) }));
jest.mock("next-auth/jwt", () => ({ getToken: jest.fn().mockResolvedValue({ sub: "507f1f77bcf86cd799439011" }) }));
jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn().mockResolvedValue(null) }));
jest.mock("jose", () => ({ jwtVerify: jest.fn().mockResolvedValue({ payload: {} }) }));

const mockSave = jest.fn().mockResolvedValue(null);
jest.mock("@/app/models/User", () => ({
  __esModule: true,
  default: { findById: jest.fn() },
}));

import User from "@/app/models/User";
import { POST } from "@/app/api/whatsapp/generateCode/route";

// Ensure the NEXTAUTH_SECRET is set for jwtVerify path
beforeAll(() => {
  process.env.NEXTAUTH_SECRET = "test-secret";
});

describe("POST /api/whatsapp/generateCode", () => {
  it("salva e retorna um código de verificação", async () => {
    const user = {
      _id: new mongoose.Types.ObjectId("507f1f77bcf86cd799439011"),
      whatsappPhone: null,
      whatsappVerificationCode: null as string | null,
      whatsappVerified: false,
      save: mockSave,
    };
    (User.findById as jest.Mock).mockResolvedValue(user);

    const request = new NextRequest("http://localhost/api/whatsapp/generateCode", { method: "POST" });
    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.code).toHaveLength(6);
    expect(user.whatsappVerificationCode).toBeTruthy();
    expect(mockSave).toHaveBeenCalled();
  });
});
