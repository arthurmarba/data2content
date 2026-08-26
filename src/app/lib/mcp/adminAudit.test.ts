/** @jest-environment node */

import { connectToDatabase } from "@/app/lib/mongoose";
import McpAdminAuditEventModel from "@/app/models/McpAdminAuditEvent";
import {
  beginMcpAdminAuditEvent,
  completeMcpAdminAuditEvent,
  McpAdminAuditUnavailableError,
} from "./adminAudit";

jest.mock("@/app/lib/mongoose", () => ({ connectToDatabase: jest.fn() }));
jest.mock("@/app/lib/logger", () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() },
}));
jest.mock("@/app/models/McpAdminAuditEvent", () => ({
  __esModule: true,
  default: { create: jest.fn(), updateOne: jest.fn() },
}));

const mockConnect = connectToDatabase as jest.MockedFunction<typeof connectToDatabase>;
const mockCreate = McpAdminAuditEventModel.create as jest.MockedFunction<
  typeof McpAdminAuditEventModel.create
>;
const mockUpdateOne = McpAdminAuditEventModel.updateOne as jest.MockedFunction<
  typeof McpAdminAuditEventModel.updateOne
>;

describe("MCP admin fail-closed audit", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockConnect.mockResolvedValue(undefined as never);
    mockCreate.mockResolvedValue({} as never);
    mockUpdateOne.mockResolvedValue({ matchedCount: 1 } as never);
  });

  it("persists a started event before a tool may read data", async () => {
    const invocationId = await beginMcpAdminAuditEvent({
      requestId: "request-1",
      actorUserId: "507f1f77bcf86cd799439011",
      targetCreatorIds: ["507f1f77bcf86cd799439021"],
      clientId: "client-1",
      tool: "fetch",
      scopes: ["admin:creator:read"],
    });

    expect(invocationId).toEqual(expect.any(String));
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      invocationId,
      requestId: "request-1",
      status: "started",
      expiresAt: expect.any(Date),
    }));
  });

  it("fails closed when the initial audit write is unavailable", async () => {
    mockCreate.mockRejectedValueOnce(new Error("mongo unavailable"));

    await expect(beginMcpAdminAuditEvent({
      requestId: "request-2",
      actorUserId: "507f1f77bcf86cd799439011",
      tool: "search",
      scopes: ["admin:creators:search"],
    })).rejects.toBeInstanceOf(McpAdminAuditUnavailableError);
  });

  it("fails closed if the terminal audit update cannot be confirmed", async () => {
    mockUpdateOne.mockResolvedValueOnce({ matchedCount: 0 } as never);

    await expect(completeMcpAdminAuditEvent("invocation-1", {
      status: "success",
      durationMs: 12,
      resultCount: 1,
    })).rejects.toBeInstanceOf(McpAdminAuditUnavailableError);
  });
});
