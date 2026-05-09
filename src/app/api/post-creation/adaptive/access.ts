type PostCreationAdaptiveServerAccessResult =
  | {
      ok: true;
    }
  | {
      ok: false;
      status: number;
      error: string;
      reason: string;
    };

export function isPostCreationAdaptiveServerEnvEnabled(): boolean {
  return process.env.NEXT_PUBLIC_POST_CREATION_ADAPTIVE_ENABLED === "1";
}

export function validatePostCreationAdaptiveServerAccess(params: {
  session: any;
}): PostCreationAdaptiveServerAccessResult {
  if (isPostCreationAdaptiveServerEnvEnabled()) {
    return { ok: true };
  }

  const role = String(params.session?.user?.role || "").trim().toLowerCase();
  if (role === "admin" || role === "dev") {
    return { ok: true };
  }

  return {
    ok: false,
    status: 403,
    error: "Experiência adaptativa indisponível.",
    reason: "post_creation_adaptive_disabled",
  };
}
