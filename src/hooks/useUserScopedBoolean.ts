"use client";

import { useCallback, useEffect, useState } from "react";

export function useUserScopedBoolean(
  key: string,
  userId?: string | null,
  defaultValue = false
): [boolean, (value: boolean | ((prev: boolean) => boolean)) => void, boolean] {
  const storageKey = typeof window !== "undefined" && userId ? `${key}:${userId}` : null;
  const [value, setValue] = useState<boolean>(defaultValue);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") {
      setValue(defaultValue);
      setHydrated(true);
      return;
    }

    if (!storageKey) {
      setValue(defaultValue);
      setHydrated(true);
      return;
    }

    try {
      const raw = window.localStorage.getItem(storageKey);
      if (raw === "1") {
        setValue(true);
      } else if (raw === "0") {
        setValue(false);
      } else {
        setValue(defaultValue);
      }
    } catch {
      setValue(defaultValue);
    } finally {
      setHydrated(true);
    }
  }, [storageKey, defaultValue]);

  const update = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (prev: boolean) => boolean)(prev) : next;
        if (typeof window !== "undefined" && storageKey) {
          try {
            window.localStorage.setItem(storageKey, resolved ? "1" : "0");
          } catch {
            /* ignore */
          }
        }
        return resolved;
      });
    },
    [storageKey]
  );

  return [value, update, hydrated];
}
