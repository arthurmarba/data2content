import React from 'react';
import { MagnifyingGlassIcon, FunnelIcon, XMarkIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { AdminCreatorSurveyListParams } from '@/types/admin/creatorSurvey';

interface CreatorFiltersProps {
    filters: AdminCreatorSurveyListParams;
    onFilterChange: (newFilters: AdminCreatorSurveyListParams) => void;
    onClearFilters: () => void;
    totalFiltered: number;
    loading: boolean;
    nicheInput?: string;
    onNicheInputChange?: (val: string) => void;
    brandInput?: string;
    onBrandInputChange?: (val: string) => void;
}

export default function CreatorFilters({
    filters,
    onFilterChange,
    onClearFilters,
    nicheInput = '',
    onNicheInputChange,
    brandInput = '',
    onBrandInputChange
}: CreatorFiltersProps) {
    const [showAdvanced, setShowAdvanced] = React.useState(false);

    // Helper to handle updates
    const updateFilter = React.useCallback((updates: Partial<AdminCreatorSurveyListParams>) => {
        onFilterChange({ ...filters, ...updates, page: 1 });
    }, [filters, onFilterChange]);

    const handleDatePreset = (preset: string) => {
        let dateFrom: string | undefined;
        const now = new Date();
        switch (preset) {
            case 'today':
                dateFrom = new Date(now.setHours(0, 0, 0, 0)).toISOString();
                break;
            case 'week':
                const weekAgo = new Date(now);
                weekAgo.setDate(now.getDate() - 7);
                dateFrom = weekAgo.toISOString();
                break;
            case 'month':
                const monthAgo = new Date(now);
                monthAgo.setMonth(now.getMonth() - 1);
                dateFrom = monthAgo.toISOString();
                break;
            default:
                dateFrom = undefined;
        }
        updateFilter({ dateFrom });
    };

    const activeChips = React.useMemo(() => {
        const chips: { label: string; value: string; onRemove: () => void }[] = [];
        if (filters.search) chips.push({ label: 'Busca', value: filters.search, onRemove: () => updateFilter({ search: undefined }) });
        if (filters.city?.length) chips.push({ label: 'Cidade', value: filters.city.join(', '), onRemove: () => updateFilter({ city: undefined }) });
        if (filters.niches?.length) chips.push({ label: 'Nicho', value: filters.niches.join(', '), onRemove: () => { updateFilter({ niches: undefined }); onNicheInputChange?.(''); } });
        if (filters.brandTerritories?.length) chips.push({ label: 'Território', value: filters.brandTerritories.join(', '), onRemove: () => { updateFilter({ brandTerritories: undefined }); onBrandInputChange?.(''); } });
        if (filters.engagementMin) chips.push({ label: 'Engaj. Mín', value: `${filters.engagementMin}%`, onRemove: () => updateFilter({ engagementMin: undefined }) });
        if (filters.followersMin) chips.push({ label: 'Seg. Mín', value: filters.followersMin.toString(), onRemove: () => updateFilter({ followersMin: undefined }) });

        return chips;
    }, [filters, updateFilter, onNicheInputChange, onBrandInputChange]);

    return (
        <div className="space-y-4 mb-6">
            {/* Search Bar & Primary Actions */}
            <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 shadow-sm transition-shadow"
                        placeholder="Buscar por nome, email ou @username..."
                        value={filters.search || ''}
                        onChange={(e) => updateFilter({ search: e.target.value })}
                    />
                </div>
                <button
                    onClick={() => setShowAdvanced(!showAdvanced)}
                    className={`px-4 py-2.5 rounded-lg border flex items-center gap-2 font-medium transition-colors ${showAdvanced ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                        }`}
                >
                    <FunnelIcon className="w-5 h-5" />
                    Filtros Avançados
                    <ChevronDownIcon className={`w-4 h-4 transition-transform ${showAdvanced ? 'rotate-180' : ''}`} />
                </button>
            </div>

            {/* Advanced Filters Panel */}
            {showAdvanced && (
                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-x-6 gap-y-4">

                        {/* Location Group */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Localização</label>
                            <div className="grid grid-cols-1 gap-2">
                                <input
                                    type="text"
                                    placeholder="Cidade (separe por vírgula)"
                                    value={filters.city?.join(', ') || ''}
                                    onChange={(e) => updateFilter({ city: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                                    className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Content Group */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Conteúdo</label>
                            <div className="space-y-2">
                                <input
                                    type="text"
                                    placeholder="Nicho (ex: moda)"
                                    value={nicheInput}
                                    onChange={(e) => onNicheInputChange?.(e.target.value)}
                                    onBlur={() => updateFilter({ niches: nicheInput ? nicheInput.split(',').map(s => s.trim()).filter(Boolean) : undefined })}
                                    className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                                <input
                                    type="text"
                                    placeholder="Território de marca"
                                    value={brandInput}
                                    onChange={(e) => onBrandInputChange?.(e.target.value)}
                                    onBlur={() => updateFilter({ brandTerritories: brandInput ? brandInput.split(',').map(s => s.trim()).filter(Boolean) : undefined })}
                                    className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500"
                                />
                            </div>
                        </div>

                        {/* Metrics Group */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Métricas Mínimas</label>
                            <div className="grid grid-cols-2 gap-2">
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="Seguidores"
                                        value={filters.followersMin || ''}
                                        onChange={(e) => updateFilter({ followersMin: e.target.value ? Number(e.target.value) : undefined })}
                                        className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500 pl-2"
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="number"
                                        placeholder="Engaj %"
                                        step="0.1"
                                        value={filters.engagementMin || ''}
                                        onChange={(e) => updateFilter({ engagementMin: e.target.value ? Number(e.target.value) : undefined })}
                                        className="w-full rounded-md border-gray-300 text-sm focus:ring-indigo-500 focus:border-indigo-500 pl-2"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Presets & Actions */}
                        <div className="space-y-3 flex flex-col justify-end">
                            <div className="flex gap-2">
                                <button onClick={() => handleDatePreset('week')} className="flex-1 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium">Últimos 7 dias</button>
                                <button onClick={() => handleDatePreset('month')} className="flex-1 py-1.5 text-xs bg-gray-100 hover:bg-gray-200 rounded text-gray-700 font-medium">Último Mês</button>
                            </div>
                            <button
                                onClick={onClearFilters}
                                className="w-full flex items-center justify-center gap-2 py-2 text-sm text-red-600 bg-red-50 hover:bg-red-100 rounded-lg transition-colors"
                            >
                                <XMarkIcon className="w-4 h-4" />
                                Limpar todos os filtros
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Active Chips Row */}
            {activeChips.length > 0 && (
                <div className="flex flex-wrap items-center gap-2 animate-in fade-in duration-300">
                    <span className="text-xs font-medium text-gray-500 mr-1">Filtros ativos:</span>
                    {activeChips.map((chip, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 text-indigo-700 text-xs font-medium border border-indigo-100 shadow-sm">
                            <span className="opacity-75">{chip.label}:</span>
                            {chip.value}
                            <button onClick={chip.onRemove} className="ml-1 hover:text-indigo-900 focus:outline-none">
                                <XMarkIcon className="w-3 h-3" />
                            </button>
                        </span>
                    ))}
                    <button onClick={onClearFilters} className="text-xs text-gray-500 hover:text-gray-700 underline ml-2">
                        Limpar tudo
                    </button>
                </div>
            )}
        </div>
    );
}
