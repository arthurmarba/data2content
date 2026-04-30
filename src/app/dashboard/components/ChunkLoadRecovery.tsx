"use client";

import * as React from "react";

const RECOVERY_KEY = "d2c.chunk_load_recovery";
const RECOVERY_WINDOW_MS = 10_000;

function isChunkLoadError(value: unknown) {
  const message =
    value instanceof Error
      ? value.message
      : typeof value === "string"
        ? value
        : value && typeof value === "object" && "message" in value
          ? String((value as { message?: unknown }).message || "")
          : "";

  return /ChunkLoadError|Loading chunk .* failed|missing: .*_next\/static\/chunks/i.test(message);
}

export default function ChunkLoadRecovery() {
  React.useEffect(() => {
    const recover = (error: unknown) => {
      if (!isChunkLoadError(error)) return;

      const now = Date.now();
      const lastRecovery = Number(window.sessionStorage.getItem(RECOVERY_KEY) || "0");
      if (Number.isFinite(lastRecovery) && now - lastRecovery < RECOVERY_WINDOW_MS) return;

      window.sessionStorage.setItem(RECOVERY_KEY, String(now));
      window.location.reload();
    };

    const handleError = (event: ErrorEvent) => {
      recover(event.error || event.message);
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      recover(event.reason);
    };

    window.addEventListener("error", handleError);
    window.addEventListener("unhandledrejection", handleUnhandledRejection);

    return () => {
      window.removeEventListener("error", handleError);
      window.removeEventListener("unhandledrejection", handleUnhandledRejection);
    };
  }, []);

  return null;
}
