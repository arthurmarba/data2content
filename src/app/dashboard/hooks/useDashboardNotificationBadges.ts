import { useEffect } from "react";
import useSWR from "swr";
import { useLocalStorage } from "@/hooks/useLocalStorage";

const LAST_VIEWED_POST_REVIEWS_AT_KEY = "d2c_last_viewed_reviews_at";
const LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY = "d2c_last_viewed_script_recommendations_at";
const LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY = "d2c_last_viewed_script_admin_feedback_at";

interface NotificationBadgesResponse {
  alertsUnreadCount: number;
  reviewsUnreadCount: number;
  scriptsUnreadCount: number;
}

const EMPTY_COUNTS: NotificationBadgesResponse = {
  alertsUnreadCount: 0,
  reviewsUnreadCount: 0,
  scriptsUnreadCount: 0,
};

export function useDashboardNotificationBadges() {
  const [lastViewedReviewsAt] = useLocalStorage<string>(LAST_VIEWED_POST_REVIEWS_AT_KEY, "");
  const [lastViewedRecommendationsAt] = useLocalStorage<string>(
    LAST_VIEWED_SCRIPTS_RECOMMENDATIONS_AT_KEY,
    ""
  );
  const [lastViewedFeedbackAt] = useLocalStorage<string>(LAST_VIEWED_SCRIPTS_ADMIN_FEEDBACK_AT_KEY, "");

  const params = new URLSearchParams({ reviewsLimit: "50" });
  if (lastViewedReviewsAt) {
    params.set("reviewsSince", lastViewedReviewsAt);
  }
  if (lastViewedRecommendationsAt) {
    params.set("scriptsRecommendationsSince", lastViewedRecommendationsAt);
  }
  if (lastViewedFeedbackAt) {
    params.set("scriptsFeedbackSince", lastViewedFeedbackAt);
  }

  const endpoint = `/api/dashboard/notifications/badges?${params.toString()}`;

  const { data, mutate } = useSWR<NotificationBadgesResponse>(
    endpoint,
    async (url: string) => {
      const res = await fetch(url);
      if (!res.ok) return EMPTY_COUNTS;
      const payload = (await res.json().catch(() => ({}))) as Partial<NotificationBadgesResponse>;
      return {
        alertsUnreadCount:
          typeof payload.alertsUnreadCount === "number" ? payload.alertsUnreadCount : 0,
        reviewsUnreadCount:
          typeof payload.reviewsUnreadCount === "number" ? payload.reviewsUnreadCount : 0,
        scriptsUnreadCount:
          typeof payload.scriptsUnreadCount === "number" ? payload.scriptsUnreadCount : 0,
      };
    },
    {
      refreshInterval: 60000,
      refreshWhenHidden: false,
      revalidateOnFocus: false,
      dedupingInterval: 30000,
    }
  );

  useEffect(() => {
    const handleStorage = (e: StorageEvent | CustomEvent) => {
      const changedKey = e instanceof StorageEvent ? e.key : (e as CustomEvent).detail?.key;
      if (
        changedKey === LAST_VIEWED_POST_REVIEWS_AT_KEY ||
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

  return {
    alertsUnreadCount: typeof data?.alertsUnreadCount === "number" ? data.alertsUnreadCount : 0,
    reviewsUnreadCount: typeof data?.reviewsUnreadCount === "number" ? data.reviewsUnreadCount : 0,
    scriptsUnreadCount: typeof data?.scriptsUnreadCount === "number" ? data.scriptsUnreadCount : 0,
    refresh: mutate,
  };
}
