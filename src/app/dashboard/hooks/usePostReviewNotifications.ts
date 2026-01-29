import useSWR from 'swr';
import { useLocalStorage } from '@/hooks/useLocalStorage';

interface LatestReviewResponse {
    items: Array<{
        updatedAt: string;
    }>;
}

export function usePostReviewNotifications() {
    const [lastViewedAt] = useLocalStorage<string>('d2c_last_viewed_reviews_at', '');

    const { data } = useSWR<LatestReviewResponse>(
        '/api/dashboard/post-reviews?limit=1&sortBy=updatedAt&sortOrder=desc',
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

    const latestReviewDate = data?.items?.[0]?.updatedAt;

    if (!latestReviewDate) return 0;
    if (!lastViewedAt) return 1; // User never viewed, show badge if there is a review

    const hasNew = new Date(latestReviewDate).getTime() > new Date(lastViewedAt).getTime();
    return hasNew ? 1 : 0;
}
