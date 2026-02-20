import useSWR from 'swr';
import { useLocalStorage } from '@/hooks/useLocalStorage';
import { useEffect } from 'react';

interface UnreadReviewCountResponse {
    unreadCount: number;
}

export function usePostReviewNotifications() {
    const [lastViewedAt] = useLocalStorage<string>('d2c_last_viewed_reviews_at', '');

    const params = new URLSearchParams({ limit: '50' });
    if (lastViewedAt) {
        params.set('since', lastViewedAt);
    }
    const endpoint = `/api/dashboard/post-reviews/unread-count?${params.toString()}`;

    const { data, mutate } = useSWR<UnreadReviewCountResponse>(
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

    return typeof data?.unreadCount === 'number' ? data.unreadCount : 0;
}
