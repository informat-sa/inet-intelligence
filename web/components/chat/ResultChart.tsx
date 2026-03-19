"use client";
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid,
  Tooltip, Legend, ResponsiveContainer,
} from "recharts";
import { formatNumber } from "@/lib/utils";
import type { QueryResult } from "@/types";

const COLORS = ["#2E75B6","#1B3A5C","#06B6D4","#8B5CF6","#10B981","#F59E0B","#EF4444","#EC4899"];

interface Props { result: QueryResult }

export function ResultChart({ result }: Props) {
  const { data = [], chartConfig } = result;
  if (!chartConfig || data.length === 0) return null;

  const { type, xKey, yKey, xLabel, yLabel } = chartConfig;

  const tickFormatter = (v: number) => {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1)}M`;
    if (v >= 1_000) return `${(v / 1_000).toFixed(0)}K`;
    return formatNumber(v);
  };

  const tooltipFormatter = (value: number) => [formatNumber(value), yLabel ?? yKey];

  const commonProps = {
    data,
    margin: { top: 8, right: 16, left: 8, bottom: 8 },
  };

  return (
    <div className="mt-3 bg-white dark:bg-slate-800/50 rounded-xl border border-slate-100
                    dark:border-slate-700 p-4">
      <ResponsiveContainer width="100%" height={260}>
        {type === "bar" ? (
          <BarChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} label={xLabel ? { value: xLabel, position: "insideBottom", offset: -4, fontSize: 11 } : undefined} />
            <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 11 }} label={yLabel ? { value: yLabel, angle: -90, position: "insideLeft", fontSize: 11 } : undefined} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 8, border: "1px solid #E2E8F0" }} />
            <Bar dataKey={yKey} fill="#2E75B6" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Bar>
          </BarChart>
        ) : type === "line" ? (
          <LineChart {...commonProps}>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 11 }} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Line type="monotone" dataKey={yKey} stroke="#2E75B6" strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} />
          </LineChart>
        ) : type === "area" ? (
          <AreaChart {...commonProps}>
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2E75B6" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2E75B6" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
            <XAxis dataKey={xKey} tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={tickFormatter} tick={{ fontSize: 11 }} />
            <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Area type="monotone" dataKey={yKey} stroke="#2E75B6" strokeWidth={2} fill="url(#areaGrad)" />
          </AreaChart>
        ) : (
          <PieChart>
            <Pie data={data} dataKey={yKey} nameKey={xKey} cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false}>
              {data.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={tooltipFormatter} contentStyle={{ fontSize: 12, borderRadius: 8 }} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
          </PieChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
