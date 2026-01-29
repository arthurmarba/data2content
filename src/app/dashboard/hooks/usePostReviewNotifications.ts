import useSWR from 'swr';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useEffect } from 'react';

interface LatestReviewResponse {
    items: Array<{
        updatedAt: string;
    }>;
}

export function usePostReviewNotifications() {
    const [lastViewedAt] = useLocalStorage<string>('d2c_last_viewed_reviews_at', '');

    const { data, mutate } = useSWR<LatestReviewResponse>(
        '/api/dashboard/post-reviews?limit=50&sortBy=updatedAt&sortOrder=desc',

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

    // Sync across components in the same window
    useEffect(() => {
        const handleStorage = (e: StorageEvent | CustomEvent) => {
            if (e instanceof StorageEvent && e.key === 'd2c_last_viewed_reviews_at') {
                mutate();
            } else if (e.type === 'local-storage-update' && (e as CustomEvent).detail?.key === 'd2c_last_viewed_reviews_at') {
                mutate();
            }
        };
        window.addEventListener('storage', handleStorage);
        window.addEventListener('local-storage-update' as any, handleStorage);
        return () => {
            window.removeEventListener('storage', handleStorage);
            window.removeEventListener('local-storage-update' as any, handleStorage);
        };
    }, [mutate]);

    if (!data?.items?.length) return 0;
    if (!lastViewedAt) return data.items.length;

    const lastViewedTime = new Date(lastViewedAt).getTime();
    const unreadCount = data.items.filter(item => new Date(item.updatedAt).getTime() > lastViewedTime).length;

    return unreadCount;
}

