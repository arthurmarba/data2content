export type InternalPreviewUser = {
  role?: string | null;
  isAdmin?: boolean | null;
  isDev?: boolean | null;
  email?: string | null;
};

export function canAccessInternalPreview(
  user: InternalPreviewUser | null | undefined,
  env: { NODE_ENV?: string; MOBILE_STRATEGIC_PROFILE_LOCAL_PREVIEW_BYPASS?: string } = process.env,
): boolean {
  // Local dev bypass: allow unauthenticated access when explicitly enabled
  if (
    env.NODE_ENV !== "production" &&
    env.MOBILE_STRATEGIC_PROFILE_LOCAL_PREVIEW_BYPASS === "1"
  ) {
    return true;
  }
  if (!user) return false;
  if (user.isAdmin === true || user.isDev === true) return true;

  const normalizedRole = typeof user.role === "string" ? user.role.trim().toLowerCase() : "";
  return normalizedRole === "admin" || normalizedRole === "dev";
}

export async function getCurrentInternalPreviewUser(): Promise<InternalPreviewUser | null> {
  const [{ getServerSession }, { authOptions }] = await Promise.all([
    import("next-auth"),
    import("@/app/api/auth/[...nextauth]/route"),
  ]);
  const session = await getServerSession(authOptions);

  return session?.user || null;
}
