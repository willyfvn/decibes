import { useState, useMemo } from "react";
import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const RANGES = [
  { label: "10m", ms: 10 * 60 * 1000 },
  { label: "30m", ms: 30 * 60 * 1000 },
  { label: "1h", ms: 60 * 60 * 1000 },
  { label: "4h", ms: 4 * 60 * 60 * 1000 },
  { label: "8h", ms: 8 * 60 * 60 * 1000 },
  { label: "24h", ms: 24 * 60 * 60 * 1000 },
] as const;

function formatTimeAxis(timestamp: number, rangeMs: number) {
  const d = new Date(timestamp);
  if (rangeMs <= 60 * 60 * 1000) {
    return d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });
  }
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatTooltipTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function downsample(
  data: { timestamp: number; value: number }[],
  maxPoints: number
) {
  if (data.length <= maxPoints) return data;
  const step = Math.ceil(data.length / maxPoints);
  const result: typeof data = [];
  for (let i = 0; i < data.length; i += step) {
    const chunk = data.slice(i, i + step);
    const avg = chunk.reduce((s, d) => s + d.value, 0) / chunk.length;
    result.push({
      timestamp: chunk[Math.floor(chunk.length / 2)].timestamp,
      value: Math.round(avg * 10) / 10,
    });
  }
  return result;
}

function toLocalDateString(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

type Mode = "live" | "date";

export default function LiveGraph() {
  const [mode, setMode] = useState<Mode>("live");
  const [rangeIdx, setRangeIdx] = useState(0);
  const [selectedDate, setSelectedDate] = useState(() =>
    toLocalDateString(new Date())
  );

  const range = RANGES[rangeIdx];

  const queryArgs = useMemo(() => {
    if (mode === "live") {
      return { startTime: Date.now() - range.ms };
    }
    // Date mode: full day from midnight to midnight local time
    const dayStart = new Date(selectedDate + "T00:00:00");
    const dayEnd = new Date(selectedDate + "T23:59:59.999");
    return { startTime: dayStart.getTime(), endTime: dayEnd.getTime() };
  }, [mode, range.ms, selectedDate]);

  const readings = useQuery(api.readings.getReadingsInRange, queryArgs);

  const displayRangeMs = mode === "live" ? range.ms : 24 * 60 * 60 * 1000;

  const chartData = useMemo(() => {
    if (!readings) return [];
    return downsample(
      readings.map((r) => ({ timestamp: r.timestamp, value: r.value })),
      200
    );
  }, [readings]);

  const latest =
    readings && readings.length > 0
      ? readings[readings.length - 1]
      : null;
  const avg =
    readings && readings.length > 0
      ? Math.round(
          (readings.reduce((s, r) => s + r.value, 0) / readings.length) * 10
        ) / 10
      : null;
  const peak =
    readings && readings.length > 0
      ? Math.max(...readings.map((r) => r.value))
      : null;

  const isToday = selectedDate === toLocalDateString(new Date());

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 flex flex-col h-full shadow-sm">
      {/* Mode tabs */}
      <div className="flex gap-1 mb-3">
        <button
          onClick={() => setMode("live")}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            mode === "live"
              ? "bg-emerald-600 text-white"
              : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
          }`}
        >
          Live
        </button>
        <button
          onClick={() => setMode("date")}
          className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
            mode === "date"
              ? "bg-emerald-600 text-white"
              : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
          }`}
        >
          Date
        </button>
      </div>

      {/* Header with current/latest reading */}
      <div className="flex items-baseline justify-between mb-2">
        <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider">
          {mode === "live" ? "Live dB" : new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })}
        </h2>
        {latest && (
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-bold tabular-nums text-neutral-900">
              {latest.value.toFixed(1)}
            </span>
            <span className="text-sm text-neutral-400">dB</span>
          </div>
        )}
      </div>

      {/* Stats row */}
      {avg !== null && peak !== null && (
        <div className="flex gap-4 mb-3 text-xs text-neutral-500">
          <span>
            Avg <span className="font-medium text-neutral-700">{avg}</span> dB
          </span>
          <span>
            Peak{" "}
            <span className="font-medium text-neutral-700">
              {peak.toFixed(1)}
            </span>{" "}
            dB
          </span>
          <span>
            <span className="font-medium text-neutral-700">
              {readings?.length ?? 0}
            </span>{" "}
            readings
          </span>
        </div>
      )}

      {/* Controls: time range buttons OR date picker */}
      {mode === "live" ? (
        <div className="flex gap-1 mb-3">
          {RANGES.map((r, i) => (
            <button
              key={r.label}
              onClick={() => setRangeIdx(i)}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                i === rangeIdx
                  ? "bg-neutral-900 text-white"
                  : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      ) : (
        <div className="flex items-center gap-2 mb-3">
          <button
            onClick={() => {
              const d = new Date(selectedDate + "T00:00:00");
              d.setDate(d.getDate() - 1);
              setSelectedDate(toLocalDateString(d));
            }}
            className="px-2 py-1 rounded-md text-xs font-medium bg-neutral-100 text-neutral-500 hover:bg-neutral-200 transition-colors"
          >
            &larr;
          </button>
          <input
            type="date"
            value={selectedDate}
            max={toLocalDateString(new Date())}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="px-2 py-1 rounded-md text-xs font-medium border border-neutral-200 bg-white text-neutral-700 outline-none focus:border-neutral-400"
          />
          <button
            onClick={() => {
              const d = new Date(selectedDate + "T00:00:00");
              d.setDate(d.getDate() + 1);
              const next = toLocalDateString(d);
              if (next <= toLocalDateString(new Date())) {
                setSelectedDate(next);
              }
            }}
            disabled={isToday}
            className={`px-2 py-1 rounded-md text-xs font-medium transition-colors ${
              isToday
                ? "bg-neutral-50 text-neutral-300 cursor-not-allowed"
                : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
            }`}
          >
            &rarr;
          </button>
        </div>
      )}

      {/* Chart */}
      <div className="flex-1 min-h-[250px]">
        {!readings ? (
          <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
            Loading...
          </div>
        ) : chartData.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-400 text-sm">
            No readings{mode === "date" ? " on this date" : " in this range"}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={chartData}
              margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="dbGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.3} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#f0f0f0"
                vertical={false}
              />
              <XAxis
                dataKey="timestamp"
                tickFormatter={(t) => formatTimeAxis(t, displayRangeMs)}
                tick={{ fontSize: 10, fill: "#a3a3a3" }}
                axisLine={false}
                tickLine={false}
                minTickGap={40}
              />
              <YAxis
                tick={{ fontSize: 10, fill: "#a3a3a3" }}
                axisLine={false}
                tickLine={false}
                domain={["dataMin - 5", "dataMax + 5"]}
                tickFormatter={(v) => `${v}`}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="rounded-lg bg-neutral-900 text-white px-3 py-2 text-xs shadow-lg">
                      <div className="font-medium">
                        {d.value.toFixed(1)} dB
                      </div>
                      <div className="text-neutral-400">
                        {formatTooltipTime(d.timestamp)}
                      </div>
                    </div>
                  );
                }}
              />
              {avg !== null && (
                <ReferenceLine
                  y={avg}
                  stroke="#a3a3a3"
                  strokeDasharray="4 4"
                  strokeWidth={1}
                />
              )}
              <Area
                type="monotone"
                dataKey="value"
                stroke="#10b981"
                strokeWidth={1.5}
                fill="url(#dbGradient)"
                dot={false}
                animationDuration={300}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <Link
        to="/history"
        className="mt-3 text-center text-sm text-emerald-600 hover:text-emerald-500 transition-colors"
      >
        View History →
      </Link>
    </div>
  );
}
