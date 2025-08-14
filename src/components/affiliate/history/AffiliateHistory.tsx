'use client';
import React, { useState } from 'react';
import { useAffiliateHistory, HistoryItem as Item } from '@/hooks/useAffiliateHistory';
import HistoryItem from './HistoryItem';
import HistoryDrawer from './HistoryDrawer';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonRow from '@/components/ui/SkeletonRow';
import ErrorState from '@/components/ui/ErrorState';

export default function AffiliateHistory() {
  const { items, loading, error, loadMore, hasMore } = useAffiliateHistory();
  const [selected, setSelected] = useState<Item | null>(null);

  if (error) return <ErrorState message="Erro ao carregar histórico." onRetry={() => location.reload()} />;
  return (
    <div>
      {loading && (
        <ul role="list" className="mb-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <li key={i} className="p-3 border rounded mb-2" role="listitem">
              <SkeletonRow />
            </li>
          ))}
        </ul>
      )}
      {!loading && items.length === 0 && <EmptyState text="Nenhum registro no período selecionado." />}
      <ul role="list">
        {items.map(item => (
          <HistoryItem key={item.id} item={item} onSelect={setSelected} />
        ))}
      </ul>
      {hasMore && (
        <button className="mt-2 w-full border rounded p-2" onClick={loadMore} aria-label="Carregar mais">
          Carregar mais
        </button>
      )}
      <HistoryDrawer item={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
