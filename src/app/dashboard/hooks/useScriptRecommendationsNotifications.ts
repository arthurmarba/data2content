import useSWR from "swr";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEffect } from "react";

const LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY = "d2c_last_viewed_script_recommendations_at";

interface ScriptsListResponse {
  items: Array<{
    updatedAt: string;
    recommendation?: {
      isRecommended?: boolean;
      recommendedAt?: string | null;
    } | null;
  }>;
}

export function useScriptRecommendationsNotifications() {
  const [lastViewedAt] = useLocalStorage<string>(LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY, "");

  const { data, mutate } = useSWR<ScriptsListResponse>(
    "/api/scripts?limit=50",
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) return { items: [] };
      return res.json();
    },
    {
      refreshInterval: 60000,
      revalidateOnFocus: true,
    }
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent | CustomEvent) => {
      if (e instanceof StorageEvent && e.key === LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY) {
        mutate();
      } else if (
        e.type === "local-storage-update" &&
        (e as CustomEvent).detail?.key === LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY
      ) {
        mutate();
      }
    };

    window.addEventListener("storage", handleStorage);
    window.addEventListener("local-storage-update" as any, handleStorage);
    return () => {
      window.removeEventListener("storage", handleStorage);
      window.removeEventListener("local-storage-update" as any, handleStorage);
    };
  }, [mutate]);

  const items = Array.isArray(data?.items) ? data.items : [];
  const recommendationItems = items.filter((item) => item?.recommendation?.isRecommended);

  if (!recommendationItems.length) return 0;
  if (!lastViewedAt) return recommendationItems.length;

  const lastViewedTime = new Date(lastViewedAt).getTime();
  if (!Number.isFinite(lastViewedTime)) return recommendationItems.length;

  const unreadCount = recommendationItems.filter((item) => {
    const sourceTime = item.recommendation?.recommendedAt || item.updatedAt;
    const ts = new Date(sourceTime).getTime();
    return Number.isFinite(ts) && ts > lastViewedTime;
  }).length;

  return unreadCount;
}

export { LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY };
