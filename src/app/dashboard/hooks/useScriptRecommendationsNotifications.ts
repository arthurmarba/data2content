import useSWR from "swr";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import { useEffect } from "react";

const LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY = "d2c_last_viewed_script_recommendations_at";
const LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY = "d2c_last_viewed_script_admin_feedback_at";

interface ScriptsListResponse {
  items: Array<{
    id?: string;
    updatedAt: string;
    recommendation?: {
      isRecommended?: boolean;
      recommendedAt?: string | null;
    } | null;
    adminAnnotation?: {
      notes?: string | null;
      updatedAt?: string | null;
    } | null;
  }>;
}

function parseTime(value?: string | null): number | null {
  if (!value) return null;
  const ts = new Date(value).getTime();
  return Number.isFinite(ts) ? ts : null;
}

function isUnread(sourceTime: string | null | undefined, lastViewedAt: string): boolean {
  if (!lastViewedAt) return true;
  const lastViewedTime = parseTime(lastViewedAt);
  if (lastViewedTime === null) return true;
  const source = parseTime(sourceTime);
  return source !== null && source > lastViewedTime;
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

  const items = Array.isArray(data?.items) ? data.items : [];
  const unreadIds = new Set<string>();

  items.forEach((item, index) => {
    const dedupeId = item.id || `idx-${index}`;

    const isRecommendationUnread =
      item?.recommendation?.isRecommended &&
      isUnread(item.recommendation?.recommendedAt || item.updatedAt, lastViewedRecommendationsAt);
    if (isRecommendationUnread) {
      unreadIds.add(dedupeId);
    }

    const hasFeedback = Boolean(item?.adminAnnotation?.notes?.trim());
    const feedbackTime = item?.adminAnnotation?.updatedAt || item.updatedAt;
    const isFeedbackUnread = hasFeedback && isUnread(feedbackTime, lastViewedFeedbackAt);
    if (isFeedbackUnread) {
      unreadIds.add(dedupeId);
    }
  });

  return unreadIds.size;
}

export { LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY, LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY };
