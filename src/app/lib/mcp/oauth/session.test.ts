import { jwtVerify } from "jose";
import { readMcpOAuthSessionUserId } from "./session";

const mockedJwtVerify = jwtVerify as jest.MockedFunction<typeof jwtVerify>;

describe("MCP OAuth Data2Content session", () => {
  const originalSecret = process.env.NEXTAUTH_SECRET;
  const userId = "507f1f77bcf86cd799439011";

  beforeEach(() => {
    process.env.NEXTAUTH_SECRET = "test-secret-with-at-least-thirty-two-characters";
    mockedJwtVerify.mockReset();
  });

  afterAll(() => {
    process.env.NEXTAUTH_SECRET = originalSecret;
  });

  it("reads a valid user id from the signed session token", async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { id: userId }, protectedHeader: { alg: "HS256" } });
    await expect(
      readMcpOAuthSessionUserId({
        getAll: () => [{ name: "next-auth.session-token", value: "signed-token" }],
      }),
    ).resolves.toBe(userId);
  });

  it("reassembles chunked secure cookies", async () => {
    mockedJwtVerify.mockResolvedValue({ payload: { sub: userId }, protectedHeader: { alg: "HS256" } });
    await expect(
      readMcpOAuthSessionUserId({
        getAll: () => [
          { name: "__Secure-next-auth.session-token.1", value: "two" },
          { name: "__Secure-next-auth.session-token.0", value: "one" },
        ],
      }),
    ).resolves.toBe(userId);
    expect(mockedJwtVerify).toHaveBeenCalledWith(
      "onetwo",
      expect.anything(),
      { algorithms: ["HS256"] },
    );
  });

  it("fails closed for invalid or missing sessions", async () => {
    mockedJwtVerify.mockRejectedValue(new Error("invalid signature"));
    await expect(
      readMcpOAuthSessionUserId({
        getAll: () => [{ name: "next-auth.session-token", value: "invalid" }],
      }),
    ).resolves.toBeNull();
    await expect(readMcpOAuthSessionUserId({ getAll: () => [] })).resolves.toBeNull();
  });
});
