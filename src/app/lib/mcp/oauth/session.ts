import mongoose from "mongoose";
import { jwtVerify } from "jose";

export interface McpOAuthCookieReader {
  getAll(): Array<{ name: string; value: string }>;
}

function readChunkedCookie(reader: McpOAuthCookieReader, baseName: string): string | null {
  const cookies = reader.getAll();
  const direct = cookies.find((cookie) => cookie.name === baseName)?.value;
  if (direct) return direct;
  const chunks = cookies
    .filter((cookie) => cookie.name.startsWith(`${baseName}.`))
    .sort((left, right) => {
      const leftIndex = Number.parseInt(left.name.slice(baseName.length + 1), 10);
      const rightIndex = Number.parseInt(right.name.slice(baseName.length + 1), 10);
      return leftIndex - rightIndex;
    });
  return chunks.length > 0 ? chunks.map((chunk) => chunk.value).join("") : null;
}

export async function readMcpOAuthSessionUserId(
  reader: McpOAuthCookieReader,
): Promise<string | null> {
  const secret = process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  const token = readChunkedCookie(reader, "__Secure-next-auth.session-token") ||
    readChunkedCookie(reader, "next-auth.session-token");
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, new TextEncoder().encode(secret), {
      algorithms: ["HS256"],
    });
    const userId = typeof payload.id === "string" ? payload.id : payload.sub;
    return typeof userId === "string" && mongoose.isValidObjectId(userId) ? userId : null;
  } catch {
    return null;
  }
}
