import useSWR from "swr";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEffect } from "react";

const LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY = "d2c_last_viewed_script_recommendations_at";
const LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY = "d2c_last_viewed_script_admin_feedback_at";

interface ScriptsUnreadCountResponse {
  unreadCount: number;
}

export function useScriptRecommendationsNotifications() {
  const [lastViewedRecommendationsAt] = useLocalStorage<string>(
    LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY,
    ""
  );
  const [lastViewedFeedbackAt] = useLocalStorage<string>(
    LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY,
    ""
  );

  const params = new URLSearchParams();
  if (lastViewedRecommendationsAt) {
    params.set("recommendationsSince", lastViewedRecommendationsAt);
  }
  if (lastViewedFeedbackAt) {
    params.set("feedbackSince", lastViewedFeedbackAt);
  }
  const endpoint = `/api/scripts/unread-count${params.toString() ? `?${params.toString()}` : ""}`;

  const { data, mutate } = useSWR<ScriptsUnreadCountResponse>(
    endpoint,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) return { unreadCount: 0 };
      return res.json();
    },
    {
      refreshInterval: 60000,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent | CustomEvent) => {
      const changedKey =
        e instanceof StorageEvent ? e.key : (e as CustomEvent).detail?.key;

      if (
        changedKey === LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY ||
        changedKey === LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY
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

  return typeof data?.unreadCount === "number" ? data.unreadCount : 0;
}

export { LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY, LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY };
