'use client';

import React, { useMemo, memo } from 'react'; // Added memo, useMemo
import {
  ResponsiveContainer,
  LineChart,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Bar,
} from 'recharts';
import { format, parseISO } from 'date-fns'; // Using date-fns for robust date formatting

export interface ICreatorTimeSeriesDataPoint {
  date: Date | string; // API might return ISO string, Recharts usually wants Date objects or timestamps
  value: number;
}

interface CreatorTimeSeriesChartProps {
  data: ICreatorTimeSeriesDataPoint[];
  metricLabel: string;
  // periodLabel?: string; // Example: 'Monthly', 'Weekly' - can be used in title or axis
  isLoading: boolean;
  error?: string | null;
  chartType?: 'line' | 'bar';
  period?: 'monthly' | 'weekly'; // To adjust date formatting
}

// Helper to format date for XAxis ticks - defined outside as it's pure
const formatDateTick = (tickItem: Date | string, period?: 'monthly' | 'weekly'): string => {
  try {
    const date = typeof tickItem === 'string' ? parseISO(tickItem) : tickItem;
    if (period === 'monthly') {
      return format(date, 'MMM/yy');
    }
    return format(date, 'dd/MM'); // Default to dd/MM for weekly or other cases
  } catch (e) {
    return String(tickItem); // Fallback
  }
};

// Helper to format date for Tooltip - defined outside
const formatTooltipDate = (date: Date | string, period?: 'monthly' | 'weekly'): string => {
   try {
    const d = typeof date === 'string' ? parseISO(date) : date;
    if (period === 'monthly') {
      return format(d, 'MMMM yyyy');
    }
    return format(d, 'PPP'); 
  } catch (e) {
    return String(date);
  }
};

// CustomTooltipContent is a functional component, can be memoized if complex or if props change frequently
const CustomTooltipContent = memo(({ active, payload, label, metricLabel, period }: any) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white dark:bg-gray-800 p-3 shadow-lg rounded-md border border-gray-200 dark:border-gray-700 text-sm">
        <p className="font-semibold text-gray-900 dark:text-white mb-1">
          {formatTooltipDate(label, period)}
        </p>
        <p className="text-indigo-600 dark:text-indigo-400">
          {metricLabel}: <span className="font-medium">{payload[0].value.toLocaleString(undefined, {minimumFractionDigits: 0, maximumFractionDigits: 2})}</span>
        </p>
      </div>
    );
  }
  return null;
});
CustomTooltipContent.displayName = 'CustomTooltipContent'; // Good practice for memoized components


const CreatorTimeSeriesChart = memo(function CreatorTimeSeriesChart({
  data,
  metricLabel,
  isLoading,
  error,
  chartType = 'line',
  period = 'monthly',
}: CreatorTimeSeriesChartProps) {
  
  const processedData = useMemo(() => {
    if (!data) return [];
    return data.map(item => ({
      ...item,
      // Ensure date is a Date object for Recharts, if it's a string, parse it.
      date: typeof item.date === 'string' ? parseISO(item.date) : item.date,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64 w-full bg-gray-50 dark:bg-gray-800/30 rounded-md">
        <p className="text-gray-500 dark:text-gray-400">Carregando dados do gráfico...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-64 w-full bg-red-50 dark:bg-red-900/30 rounded-md p-4">
        <p className="text-red-600 dark:text-red-300 text-center">Erro ao carregar dados: {error}</p>
      </div>
    );
  }

  if (processedData.length === 0) { // Check processedData instead of raw data
    return (
      <div className="flex items-center justify-center h-64 w-full bg-gray-50 dark:bg-gray-800/30 rounded-md">
        <p className="text-gray-500 dark:text-gray-400">Nenhum dado disponível para exibir no gráfico.</p>
      </div>
    );
  }
  
  const ChartComponent = chartType === 'line' ? LineChart : BarChart;

  return (
    <div className="h-72 md:h-80 w-full"> {/* Fixed height for chart container */}
      <ResponsiveContainer width="100%" height="100%">
        <ChartComponent
          data={processedData}
          margin={{
            top: 5,
            right: 20, // Adjusted for potential legend or labels
            left: 0,  // Adjusted if YAxis labels are short
            bottom: 20, // Increased for XAxis labels if rotated
          }}
        >
          <CartesianGrid strokeDasharray="3 3" strokeOpacity={0.2} className="dark:stroke-gray-600" />
          <XAxis
            dataKey="date"
            tickFormatter={(tick) => formatDateTick(tick, period)}
            fontSize={10}
            className="dark:fill-gray-400"
            tickLine={{ stroke: 'transparent' }}
            axisLine={{ stroke: 'transparent' }}
            padding={{ left: 10, right: 10 }}
            // angle={period === 'weekly' ? -30 : 0} // Optional: angle ticks for weekly if too dense
            // textAnchor={period === 'weekly' ? "end" : "middle"}
          />
          <YAxis 
            fontSize={10} 
            className="dark:fill-gray-400"
            tickLine={{ stroke: 'transparent' }}
            axisLine={{ stroke: 'transparent' }}
            tickFormatter={(value) => typeof value === 'number' ? value.toLocaleString(undefined, {notation: 'compact', compactDisplay: 'short'}) : value}
          />
          <Tooltip content={<CustomTooltipContent metricLabel={metricLabel} period={period} />} />
          {/* <Legend verticalAlign="top" height={36} iconSize={10} wrapperStyle={{fontSize: "12px"}}/> */}
          {chartType === 'line' ? (
            <Line
              type="monotone"
              dataKey="value"
              name={metricLabel}
              stroke="#4f46e5"
              strokeWidth={2}
              dot={{ r: 3, strokeWidth: 1, fill: '#fff' }}
              activeDot={{ r: 5, stroke: '#4f46e5', fill: '#4f46e5' }}
            />
          ) : (
            <Bar
              dataKey="value"
              name={metricLabel}
              fill="#4f46e5"
              barSize={period === 'monthly' ? 30 : 20}
              radius={[4, 4, 0, 0]}
            />
          )}
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
});

export default CreatorTimeSeriesChart;
