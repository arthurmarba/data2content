const ADAPTIVE_ENV_FLAG = "NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED";
const ADAPTIVE_LOCAL_STORAGE_KEY = "d2c:postCreationAdaptiveEnabled";

type SearchParamsLike = {
  get(name: string): string | null;
};

export function isPostCreationAdaptiveEnvEnabled(): boolean {
  return process.env[ADAPTIVE_ENV_FLAG] === "1";
}

export function isPostCreationAdaptiveTester(params: {
  role?: string | null;
  userId?: string | null;
}): boolean {
  const role = String(params.role || "").trim().toLowerCase();
  return role === "admin" || role === "dev";
}

export function getPostCreationAdaptiveLocalOverride(): boolean {
  try {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(ADAPTIVE_LOCAL_STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setPostCreationAdaptiveLocalOverride(enabled: boolean): void {
  try {
    if (typeof window === "undefined") return;
    if (enabled) {
      window.localStorage.setItem(ADAPTIVE_LOCAL_STORAGE_KEY, "1");
      return;
    }
    window.localStorage.removeItem(ADAPTIVE_LOCAL_STORAGE_KEY);
  } catch {
    return;
  }
}

export function shouldShowPostCreationAdaptiveExperience(params: {
  role?: string | null;
  userId?: string | null;
  searchParams?: SearchParamsLike | null;
}): boolean {
  if (isPostCreationAdaptiveEnvEnabled()) return true;
  if (!isPostCreationAdaptiveTester({ role: params.role, userId: params.userId })) return false;

  const queryOverride = params.searchParams?.get("adaptiveBoard");
  if (queryOverride === "1") {
    setPostCreationAdaptiveLocalOverride(true);
    return true;
  }
  if (queryOverride === "0") {
    setPostCreationAdaptiveLocalOverride(false);
    return false;
  }

  return getPostCreationAdaptiveLocalOverride();
}
