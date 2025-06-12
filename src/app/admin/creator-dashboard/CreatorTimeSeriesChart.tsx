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

import EmptyState from './EmptyState'; // Import EmptyState
import { ChartPieIcon, ExclamationTriangleIcon } from '@heroicons/react/24/outline'; // Example icons for chart empty/error states

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

// 1. Define the internal component with explicit return type
const CreatorTimeSeriesChartInternal = ({
  data,
  metricLabel,
  isLoading,
  error,
  chartType = 'line',
  period = 'monthly',
}: CreatorTimeSeriesChartProps): JSX.Element => {

  const processedData = useMemo(() => {
    if (!data) return [];
    return data.map(item => ({
      ...item,
      date: typeof item.date === 'string' ? parseISO(item.date) : item.date,
    }));
  }, [data]);

  if (isLoading) {
    return (
      <div className="h-72 md:h-80 w-full animate-pulse bg-gray-200 dark:bg-gray-700 rounded-md flex items-center justify-center">
        {/* Optional: text inside skeleton area */}
      </div>
    );
  }

  if (error) {
    return (
       <div className="h-72 md:h-80 w-full flex items-center justify-center bg-red-50 dark:bg-red-900/20 rounded-md p-4">
            <EmptyState
                icon={<ExclamationTriangleIcon className="w-10 h-10 text-red-500 dark:text-red-400" />}
                title="Erro ao Carregar Gráfico"
                message={error}
                smallText={true}
            />
        </div>
    );
  }

  if (processedData.length === 0) {
    return (
        <div className="h-72 md:h-80 w-full flex items-center justify-center bg-gray-50 dark:bg-gray-800/20 rounded-md">
            <EmptyState
                icon={<ChartPieIcon className="w-10 h-10" />}
                title="Sem Dados para o Gráfico"
                message={`Este criador não possui dados para a métrica "${metricLabel}" no período selecionado.`}
                smallText={true}
            />
        </div>
    );
  }

  const ChartComponent = chartType === 'line' ? LineChart : BarChart;
  const ChartElement = chartType === 'line' ? Line : Bar;

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
          <ChartElement
            type="monotone" // For LineChart
            dataKey="value"
            name={metricLabel}
            stroke={chartType === 'line' ? '#4f46e5' : undefined} // Indigo for line
            fill={chartType === 'bar' ? '#4f46e5' : undefined} // Indigo for bar
            strokeWidth={2} // For LineChart
            dot={{ r: 3, strokeWidth: 1, fill: '#fff' }} // For LineChart points
            activeDot={{ r: 5, stroke: '#4f46e5', fill: '#4f46e5' }} // For LineChart active point
            barSize={period === 'monthly' ? 30 : 20} // For BarChart
            radius={chartType === 'bar' ? [4, 4, 0, 0] : undefined} // For BarChart rounded top
          />
        </ChartComponent>
      </ResponsiveContainer>
    </div>
  );
};

// 2. Wrap with memo and assign to the desired export name
const CreatorTimeSeriesChart = memo(CreatorTimeSeriesChartInternal);

// 3. Set displayName (good practice)
CreatorTimeSeriesChart.displayName = 'CreatorTimeSeriesChart';

// 4. Export default
export default CreatorTimeSeriesChart;
