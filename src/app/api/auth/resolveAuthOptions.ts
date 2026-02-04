let cachedAuthOptions: any | null = null;

export async function resolveAuthOptions() {
  if (process.env.NODE_ENV === 'test') return {};
  if (cachedAuthOptions) return cachedAuthOptions;
  const mod = await import('@/app/api/auth/[...nextauth]/route');
  cachedAuthOptions = (mod as any)?.authOptions ?? {};
  return cachedAuthOptions;
}
