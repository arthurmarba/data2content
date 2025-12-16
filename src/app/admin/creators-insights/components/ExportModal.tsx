import React from 'react';
import { XMarkIcon } from '@heroicons/react/24/outline';
import { AdminCreatorSurveyListParams } from '@/types/admin/creatorSurvey';

interface ExportModalProps {
    isOpen: boolean;
    onClose: () => void;
    exporting: boolean;
    onExport: () => void;
    exportFormat: 'csv' | 'json';
    onFormatChange: (value: 'csv' | 'json') => void;
    columns: { key: string; label: string }[];
    exportColumns: string[];
    onToggleColumn: (key: string) => void;
    exportIncludeHistory: boolean;
    onIncludeHistoryChange: (value: boolean) => void;
    activeFilterChips: { label: string; value: string }[];
}

export default function ExportModal({
    isOpen,
    onClose,
    exporting,
    onExport,
    exportFormat,
    onFormatChange,
    columns,
    exportColumns,
    onToggleColumn,
    exportIncludeHistory,
    onIncludeHistoryChange,
    activeFilterChips,
}: ExportModalProps) {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-lg p-5 w-full max-w-md">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-gray-900">Exportar dados</h3>
                    <button onClick={onClose} className="p-2 rounded-md hover:bg-gray-100">
                        <XMarkIcon className="w-5 h-5 text-gray-600" />
                    </button>
                </div>
                <div className="space-y-3">
                    <div>
                        <label className="text-sm font-semibold text-gray-700">Formato</label>
                        <select
                            value={exportFormat}
                            onChange={(e) => onFormatChange(e.target.value as any)}
                            className="mt-1 w-full rounded-md border-gray-300 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            <option value="csv">CSV</option>
                            <option value="json">JSON</option>
                        </select>
                    </div>
                    <div>
                        <label className="text-sm font-semibold text-gray-700">Colunas (opcional)</label>
                        <div className="mt-2 grid grid-cols-2 gap-2">
                            {columns
                                .filter((c) => c.key !== 'actions')
                                .map((col) => (
                                    <label key={col.key} className="flex items-center gap-2 text-sm text-gray-700">
                                        <input
                                            type="checkbox"
                                            checked={exportColumns.includes(col.key)}
                                            onChange={() => onToggleColumn(col.key)}
                                            className="rounded text-indigo-600 border-gray-300"
                                        />
                                        {col.label}
                                    </label>
                                ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Deixe em branco para exportar todas as colunas.</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <input
                            id="export-history"
                            type="checkbox"
                            className="rounded text-indigo-600 border-gray-300"
                            checked={exportIncludeHistory}
                            onChange={(e) => onIncludeHistoryChange(e.target.checked)}
                        />
                        <label htmlFor="export-history" className="text-sm text-gray-700">
                            Incluir histórico recente de métricas (JSON)
                        </label>
                    </div>
                    <div className="text-sm text-gray-600">
                        <p>Serão exportados os criadores de acordo com os filtros aplicados.</p>
                        {activeFilterChips.length > 0 && (
                            <p className="text-xs text-gray-500 mt-1">
                                Filtros ativos: {activeFilterChips.map((c) => `${c.label}=${c.value}`).join(' · ')}
                            </p>
                        )}
                    </div>
                    <div className="flex justify-end gap-2">
                        <button
                            onClick={onClose}
                            className="px-4 py-2 rounded-md border border-gray-300 text-sm"
                            disabled={exporting}
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={onExport}
                            className="px-4 py-2 rounded-md bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
                            disabled={exporting}
                        >
                            {exporting ? 'Gerando...' : 'Exportar'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
