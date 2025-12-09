import useSWR from "swr";
import type { CreatorProfileExtended } from "@/types/landing";

const fetcher = async (url: string): Promise<CreatorProfileExtended | null> => {
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) {
    if (res.status === 401) {
      return null;
    }
    throw new Error(`Failed to load creator profile (${res.status})`);
  }
  const data = await res.json();
  if (data && "profile" in data) {
    return (data as { profile: CreatorProfileExtended | null }).profile;
  }
  return (data as CreatorProfileExtended) ?? null;
};

export default function useCreatorProfileExtended() {
  const { data, error, isLoading, isValidating, mutate } = useSWR<CreatorProfileExtended | null>(
    "/api/creator/profile-extended",
    fetcher,
    { shouldRetryOnError: false, revalidateOnFocus: false },
  );

  return {
    profile: data ?? null,
    error,
    isLoading,
    isValidating,
    mutate,
  };
}
