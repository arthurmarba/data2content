import useSWR from 'swr';
import { ConnectStatus } from '@/types/connect';

const fetcher = (url: string) =>
  fetch(url, { cache: 'no-store' }).then((r) => {
    if (!r.ok) throw new Error('fail');
    return r.json();
  });

export function useConnectStatus() {
  const { data, error, isLoading, mutate } = useSWR<ConnectStatus>(
    '/api/affiliate/connect/status',
    fetcher,
    { revalidateOnFocus: false }
  );
  return { status: data, error, isLoading, refresh: () => mutate() };
}
