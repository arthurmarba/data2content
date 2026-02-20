"use client";

import React from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";

type PubliDailyPerformanceChartDatum = {
  date: string;
  dailyViews: number;
  dailyLikes: number;
};

export default function PubliDailyPerformanceChart({
  data,
}: {
  data: PubliDailyPerformanceChartDatum[];
}) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
        <XAxis
          dataKey="date"
          tickFormatter={(str) =>
            new Date(str).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })
          }
          fontSize={12}
          tickLine={false}
          axisLine={false}
          stroke="#94A3B8"
          dy={10}
        />
        <YAxis
          fontSize={12}
          tickLine={false}
          axisLine={false}
          stroke="#94A3B8"
          tickFormatter={(val) => (val >= 1000 ? `${(val / 1000).toFixed(1)}k` : String(val))}
        />
        <Tooltip
          contentStyle={{ borderRadius: "12px", border: "none", boxShadow: "0 4px 20px rgba(0,0,0,0.08)" }}
          labelFormatter={(label) =>
            new Date(label).toLocaleDateString("pt-BR", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })
          }
        />
        <Legend wrapperStyle={{ paddingTop: "20px" }} iconType="circle" />
        <Line
          type="monotone"
          dataKey="dailyViews"
          name="Visualizações"
          stroke="#6366f1"
          strokeWidth={3}
          dot={{ r: 4, fill: "#6366f1", strokeWidth: 2, stroke: "#fff" }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
        <Line
          type="monotone"
          dataKey="dailyLikes"
          name="Curtidas"
          stroke="#ec4899"
          strokeWidth={3}
          dot={{ r: 4, fill: "#ec4899", strokeWidth: 2, stroke: "#fff" }}
          activeDot={{ r: 6, strokeWidth: 0 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
