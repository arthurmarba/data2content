import React, { useMemo } from 'react';

interface HeatmapTableProps {
    title: string;
    data?: {
        categoryValues: string[];
        metricValues: Record<string, number | undefined>; // key = categoryValue, value = metric
    };
    rows: { key: string; label: string }[];
    columns: { key: string; label: string }[];
    dataMap: Record<string, Record<string, number>>; // rowKey -> colKey -> value
    percentMap?: Record<string, Record<string, number>>; // rowKey -> colKey -> percentage (0-100)
    columnTotals?: Record<string, number>;
    onSelect?: (rowKey: string, colKey?: string) => void;
    isLoading?: boolean;
}

export default function HeatmapTable({ title, rows, columns, dataMap, percentMap, columnTotals, onSelect, isLoading }: HeatmapTableProps) {

    // Find max value to normalize intensity
    const maxValue = useMemo(() => {
        let max = 0;
        rows.forEach(r => {
            columns.forEach(c => {
                const val = dataMap[r.key]?.[c.key] || 0;
                if (val > max) max = val;
            });
        });
        return max;
    }, [rows, columns, dataMap]);

    const getIntensityColor = (value: number) => {
        if (value === 0) return 'transparent';
        const ratio = value / (maxValue || 1);
        // Indigo scale: 50 to 900
        // We'll use opacity on a base indigo color for simplicity or predefined distinct classes
        // Let's use opacity of indigo-600
        const opacity = 0.05 + (ratio * 0.95);
        return `rgba(79, 70, 229, ${opacity})`;
    };

    const getTextColor = (value: number) => {
        const ratio = value / (maxValue || 1);
        return ratio > 0.6 ? '#FFF' : '#1F2937';
    };

    return (
        <div className="bg-white p-4 rounded-lg border border-gray-200 shadow-sm overflow-x-auto">
            <div className="flex items-center justify-between mb-4">
                <h4 className="text-sm font-semibold text-gray-800">{title}</h4>
            </div>

            {isLoading ? (
                <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                    <div className="h-8 bg-gray-200 rounded w-full"></div>
                </div>
            ) : (
                <>
                    <table className="min-w-full text-xs text-center border-collapse">
                        <thead>
                            <tr>
                                <th className="p-2 text-left text-gray-500 font-medium">Categoria</th>
                                {columns.map(col => {
                                    const total = columnTotals?.[col.key];
                                    const noBase = total === 0;
                                    return (
                                        <th key={col.key} className="p-2 text-gray-700 font-semibold border-b border-gray-100 min-w-[100px]">
                                            <div className="flex flex-col items-center gap-0.5">
                                                <span>{col.label}</span>
                                                {total !== undefined ? (
                                                    <span className="text-[10px] text-gray-500">
                                                        {noBase ? 'Sem base' : `Total: ${total}`}
                                                    </span>
                                                ) : null}
                                            </div>
                                        </th>
                                    );
                                })}
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map(row => (
                                <tr key={row.key} className="hover:bg-gray-50 transition-colors">
                                    <td className="p-2 text-left text-gray-900 font-medium border-r border-gray-100 max-w-[150px] truncate" title={row.label}>
                                        {row.label}
                                    </td>
                                    {columns.map(col => {
                                        const val = dataMap[row.key]?.[col.key] || 0;
                                        const pct = percentMap?.[row.key]?.[col.key];
                                        const colTotal = columnTotals?.[col.key];
                                        const noBase = colTotal === 0;
                                        return (
                                            <td
                                                key={col.key}
                                                className="p-1 cursor-pointer"
                                                onClick={() => onSelect && onSelect(row.key, col.key)}
                                            >
                                                <div
                                                    className="w-full h-10 flex flex-col items-center justify-center rounded transition-all hover:scale-105"
                                                    style={{
                                                        backgroundColor: getIntensityColor(val),
                                                        color: getTextColor(val),
                                                        fontWeight: val > 0 ? 600 : 400
                                                    }}
                                                >
                                                    <span>{val > 0 ? val : '-'}</span>
                                                    {pct != null && val > 0 && !noBase ? (
                                                        <span className="text-[10px] text-gray-800/80">
                                                            {pct.toFixed(1)}%
                                                        </span>
                                                    ) : noBase ? (
                                                        <span className="text-[10px] text-gray-400">sem base</span>
                                                    ) : null}
                                                </div>
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    <div className="mt-2 text-[10px] text-gray-400 text-right">
                        * Intensidade da cor indica volume de respostas
                    </div>
                </>
            )}
        </div>
    );
}
