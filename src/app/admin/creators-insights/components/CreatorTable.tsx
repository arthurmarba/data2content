import React from 'react';
import { AdminCreatorSurveyListItem } from '@/types/admin/creatorSurvey';
import { AdjustmentsHorizontalIcon, FunnelIcon, EyeIcon } from '@heroicons/react/24/outline';
import SkeletonBlock from '../../components/SkeletonBlock';
import { formatDate } from '../utils';

interface CreatorTableProps {
    list: AdminCreatorSurveyListItem[];
    total: number;
    loading: boolean;
    error?: string | null;
    page: number;
    totalPages: number;
    onPageChange: (newPage: number) => void;
    onViewDetail: (id: string) => void;
    onRetry: () => void;
    sortConfig: { sortBy: string; sortOrder: 'asc' | 'desc' };
    onSort: (key: string) => void;
    visibleColumns: string[];
    onToggleColumn: (key: string) => void;
}

const ALL_COLUMNS = [
    { key: 'name', label: 'Nome / Email', sortable: true },
    { key: 'stage', label: 'Estágio', sortable: false },
    { key: 'reach', label: 'Alcance', sortable: true, headerClassName: 'text-right' },
    { key: 'engaged', label: 'Engajados', sortable: true, headerClassName: 'text-right' },
    { key: 'followersCount', label: 'Seguidores', sortable: true, headerClassName: 'text-right' },
    { key: 'engagementRate', label: 'Engajamento', sortable: true, headerClassName: 'text-right' },
    { key: 'city', label: 'Local', sortable: true },
    { key: 'hasDoneSponsoredPosts', label: 'Publis', sortable: false },
    { key: 'updatedAt', label: 'Atualizado', sortable: true },
    { key: 'actions', label: 'Ações', sortable: false, headerClassName: 'text-right' },
];

export default function CreatorTable({
    list,
    total,
    loading,
    error,
    page,
    totalPages,
    onPageChange,
    onViewDetail,
    onRetry,
    sortConfig,
    onSort,
    visibleColumns,
    onToggleColumn,
}: CreatorTableProps) {
    const [columnsMenuOpen, setColumnsMenuOpen] = React.useState(false);

    const activeColumns = React.useMemo(() => {
        return ALL_COLUMNS.filter(col => visibleColumns.includes(col.key));
    }, [visibleColumns]);

    return (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden flex flex-col">
            {/* Table Toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200 bg-gray-50/50">
                <div className="flex items-center gap-2 text-sm font-medium text-gray-600">
                    <FunnelIcon className="w-4 h-4" />
                    {total} criadores encontrados
                </div>
                <div className="relative">
                    <button
                        onClick={() => setColumnsMenuOpen(!columnsMenuOpen)}
                        className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border border-gray-300 text-xs font-medium text-gray-700 hover:bg-white hover:shadow-sm transition-all"
                    >
                        <AdjustmentsHorizontalIcon className="w-4 h-4" />
                        Colunas
                    </button>

                    {columnsMenuOpen && (
                        <>
                            <div className="fixed inset-0 z-10" onClick={() => setColumnsMenuOpen(false)} />
                            <div className="absolute right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-20 p-3 space-y-2">
                                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Exibir colunas</p>
                                {ALL_COLUMNS.filter((c) => c.key !== 'actions').map((col) => (
                                    <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 p-1 rounded">
                                        <input
                                            type="checkbox"
                                            checked={visibleColumns.includes(col.key)}
                                            onChange={() => onToggleColumn(col.key)}
                                            className="rounded text-indigo-600 border-gray-300 focus:ring-indigo-500"
                                        />
                                        {col.label}
                                    </label>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* Table Content */}
            <div className="overflow-x-auto min-h-[300px]">
                {loading ? (
                    <div className="p-6 space-y-4">
                        {[1, 2, 3, 4, 5].map((i) => (
                            <div key={i} className="flex gap-4">
                                <SkeletonBlock height="h-12" width="w-full" className="rounded-lg" />
                            </div>
                        ))}
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-red-600 font-medium mb-2">{error}</p>
                        <button onClick={onRetry} className="text-indigo-600 hover:text-indigo-800 underline text-sm">
                            Tentar Novamente
                        </button>
                    </div>
                ) : list.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center text-gray-500">
                        <FunnelIcon className="w-12 h-12 text-gray-300 mb-3" />
                        <p>Nenhum criador encontrado com os filtros atuais.</p>
                    </div>
                ) : (
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                {activeColumns.map((col) => (
                                    <th
                                        key={col.key}
                                        onClick={() => col.sortable && onSort(col.key)}
                                        className={`
                        px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider
                        ${col.sortable ? 'cursor-pointer hover:text-gray-700 hover:bg-gray-100 select-none transition-colors' : ''}
                        ${col.headerClassName || ''}
                      `}
                                    >
                                        <div className={`flex items-center gap-1 ${col.headerClassName?.includes('text-right') ? 'justify-end' : ''}`}>
                                            {col.label}
                                            {col.sortable && sortConfig.sortBy === col.key && (
                                                <span className="text-indigo-600 font-bold ml-1">
                                                    {sortConfig.sortOrder === 'asc' ? '↑' : '↓'}
                                                </span>
                                            )}
                                        </div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-100">
                            {list.map((item) => (
                                <tr
                                    key={item.id}
                                    onClick={() => onViewDetail(item.id)}
                                    className="hover:bg-indigo-50/30 transition-colors group cursor-pointer"
                                >
                                    {activeColumns.map((col) => (
                                        <td key={`${item.id}-${col.key}`} className={`px-6 py-4 whitespace-nowrap text-sm ${col.key === 'actions' ? 'text-right' : 'text-gray-600'}`}>
                                            {renderCell(col.key, item, onViewDetail)}
                                        </td>
                                    ))}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Pagination Footer */}
            {!loading && list.length > 0 && (
                <div className="bg-gray-50 px-6 py-4 border-t border-gray-200 flex items-center justify-between">
                    <span className="text-sm text-gray-700">
                        Página <span className="font-semibold">{page}</span> de <span className="font-semibold">{totalPages}</span>
                    </span>
                    <div className="flex gap-2">
                        <button
                            onClick={() => onPageChange(page - 1)}
                            disabled={page === 1}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            Anterior
                        </button>
                        <button
                            onClick={() => onPageChange(page + 1)}
                            disabled={page >= totalPages}
                            className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm transition-all"
                        >
                            Próximo
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}

function renderCell(key: string, item: AdminCreatorSurveyListItem, onViewDetail: (id: string) => void) {
    switch (key) {
        case 'name':
            return (
                <div className="flex flex-col">
                    <span className="font-semibold text-gray-900">{item.name}</span>
                    <span className="text-xs text-gray-500">{item.email}</span>
                </div>
            );
        case 'stage':
            return item.stage?.map((s, i) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800 mr-1">
                    {s}
                </span>
            )) || <span className="text-gray-400">—</span>;
        case 'reach':
            return (
                <div className="text-right font-mono font-medium text-gray-900">
                    {item.reach != null ? item.reach.toLocaleString('pt-BR') : '—'}
                </div>
            );
        case 'engaged':
            return (
                <div className="text-right font-mono font-medium text-gray-900">
                    {item.engaged != null ? item.engaged.toLocaleString('pt-BR') : '—'}
                </div>
            );
        case 'followersCount':
            return (
                <div className="text-right font-mono font-medium text-gray-900">
                    {item.followersCount?.toLocaleString('pt-BR') ?? '—'}
                </div>
            );
        case 'engagementRate':
            const eng = item.engagementRate;
            let colorClass = 'text-gray-600';
            if (eng !== undefined && eng !== null && eng > 5) colorClass = 'text-emerald-600 font-bold';
            else if (eng !== undefined && eng !== null && eng < 1) colorClass = 'text-red-500';

            return (
                <div className={`text-right font-mono ${colorClass}`}>
                    {eng != null ? `${eng.toFixed(2)}%` : '—'}
                </div>
            );
        case 'city':
            return (
                <div className="flex items-center gap-1 text-gray-500">
                    {item.city || '—'}
                    {item.country && <span className="text-xs text-gray-400">({item.country})</span>}
                </div>
            );
        case 'hasDoneSponsoredPosts':
            const status = item.hasDoneSponsoredPosts as string | null;
            const hasDone = status === 'Sim' || status === 'varias' || status === 'poucas';
            return (
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${hasDone ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                    {item.hasDoneSponsoredPosts || '—'}
                </span>
            );
        case 'updatedAt':
            return <span className="text-xs text-gray-500">{formatDate(item.updatedAt || item.createdAt)}</span>;
        case 'actions':
            return (
                <div className="flex justify-end gap-2">
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onViewDetail(item.id);
                        }}
                        title="Ver Detalhes"
                        className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                    >
                        <EyeIcon className="w-5 h-5" />
                    </button>
                </div>
            );
        default:
            return null;
    }
}
