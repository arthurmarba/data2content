'use client';
import React, { useState } from 'react';
import { useAffiliateHistory, HistoryItem as Item } from '@/hooks/useAffiliateHistory';
import HistoryItem from './HistoryItem';
import HistoryDrawer from './HistoryDrawer';
import EmptyState from '@/components/ui/EmptyState';
import SkeletonRow from '@/components/ui/SkeletonRow';
import ErrorState from '@/components/ui/ErrorState';

  export default function AffiliateHistory() {
    const [status, setStatus] = useState<string | undefined>();
    const [currency, setCurrency] = useState<string | undefined>();
    const [from, setFrom] = useState<string | undefined>();
    const [to, setTo] = useState<string | undefined>();

    const { items, isLoading, error, loadMore, hasMore, setSize } = useAffiliateHistory({
      status: status ? [status] : undefined,
      currency,
      from,
      to,
    });
    const [selected, setSelected] = useState<Item | null>(null);

    if (error) return <ErrorState message="Erro ao carregar histórico." onRetry={() => location.reload()} />;
    const resetAnd = (cb: () => void) => {
      setSize(1);
      cb();
      setSelected(null);
    };
    return (
      <div>
        <div className="mb-4 space-y-2">
          <div className="flex flex-wrap gap-2">
            {[
              { label: 'Todos', value: undefined },
              { label: 'Pendente', value: 'pending' },
              { label: 'Disponível', value: 'available' },
              { label: 'Pago', value: 'paid' },
              { label: 'Cancelado', value: 'canceled' },
              { label: 'Revertido', value: 'reversed' },
            ].map(s => (
              <button
                key={s.label}
                className={`px-3 py-1 rounded-full text-sm border ${
                  status === s.value ? 'bg-blue-500 text-white' : 'bg-gray-100'
                }`}
                onClick={() =>
                  resetAnd(() => setStatus(s.value as any))
                }
                aria-label={s.label}
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <select
              value={currency || 'all'}
              onChange={e =>
                resetAnd(() => setCurrency(e.target.value === 'all' ? undefined : e.target.value))
              }
              className="border rounded p-1 text-sm"
              aria-label="Filtrar por moeda"
            >
              <option value="all">Todas as moedas</option>
              <option value="BRL">BRL</option>
              <option value="USD">USD</option>
            </select>
            <input
              type="date"
              value={from || ''}
              onChange={e => resetAnd(() => setFrom(e.target.value || undefined))}
              className="border rounded p-1 text-sm"
              aria-label="Data inicial"
            />
            <input
              type="date"
              value={to || ''}
              onChange={e => resetAnd(() => setTo(e.target.value || undefined))}
              className="border rounded p-1 text-sm"
              aria-label="Data final"
            />
          </div>
        </div>
        {isLoading && (
          <ul role="list" className="mb-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <li key={i} className="p-3 border rounded mb-2" role="listitem">
                <SkeletonRow />
              </li>
            ))}
          </ul>
        )}
        {!isLoading && items.length === 0 && <EmptyState text="Nenhum registro no período selecionado." />}
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
