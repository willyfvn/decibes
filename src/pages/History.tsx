import { useMemo, useState } from "react";
import { usePaginatedQuery, useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

type Tab = "readings" | "recordings";

const ROOM_NAME = "decibes-main";

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatTimeShort(timestamp: number) {
  return new Date(timestamp).toLocaleString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
  if (minutes >= 60) {
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  return minutes > 0 ? `${minutes}m ${remaining}s` : `${remaining}s`;
}

export default function History() {
  const [tab, setTab] = useState<Tab>("readings");
  const [startInput, setStartInput] = useState("");
  const [endInput, setEndInput] = useState("");

  const queryArgs = useMemo(() => {
    const args: { startTime?: number; endTime?: number } = {};
    if (startInput) args.startTime = new Date(startInput).getTime();
    if (endInput) args.endTime = new Date(endInput).getTime();
    return args;
  }, [startInput, endInput]);

  const {
    results: readings,
    status,
    loadMore,
  } = usePaginatedQuery(api.readings.getReadingsPaginated, queryArgs, { initialNumItems: 50 });

  const recordings = useQuery(api.recordings.getRecordings, { roomName: ROOM_NAME });

  // Group recordings by sessionId into session cards
  const sessionGroups = useMemo(() => {
    if (!recordings) return [];
    const groups = new Map<string, typeof recordings>();
    const standalone: typeof recordings = [];
    for (const r of recordings) {
      if (r.sessionId) {
        const group = groups.get(r.sessionId);
        if (group) group.push(r);
        else groups.set(r.sessionId, [r]);
      } else {
        standalone.push(r);
      }
    }
    const result: { key: string; segments: typeof recordings; startedAt: number; totalDurationMs: number }[] = [];
    for (const [sessionId, segments] of groups) {
      const sorted = segments.sort((a, b) => (a.segmentIndex ?? 0) - (b.segmentIndex ?? 0));
      const startedAt = sorted[0].startedAt;
      const totalDurationMs = sorted.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);
      result.push({ key: sessionId, segments: sorted, startedAt, totalDurationMs });
    }
    for (const r of standalone) {
      result.push({ key: r._id, segments: [r], startedAt: r.startedAt, totalDurationMs: r.durationMs ?? 0 });
    }
    result.sort((a, b) => b.startedAt - a.startedAt);
    return result;
  }, [recordings]);

  // Group session cards by day
  const dayGroups = useMemo(() => {
    const groups: { label: string; items: typeof sessionGroups }[] = [];
    let currentDay = "";
    for (const group of sessionGroups) {
      const day = new Date(group.startedAt).toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
      if (day !== currentDay) {
        currentDay = day;
        groups.push({ label: day, items: [] });
      }
      groups[groups.length - 1].items.push(group);
    }
    return groups;
  }, [sessionGroups]);

  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <Link
          to="/"
          className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-4 inline-block"
        >
          ← Back
        </Link>

        <h1 className="text-2xl font-bold mb-6">History</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-neutral-100 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("readings")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "readings"
                ? "bg-emerald-600 text-white"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Readings
          </button>
          <button
            onClick={() => setTab("recordings")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "recordings"
                ? "bg-emerald-600 text-white"
                : "text-neutral-500 hover:text-neutral-800"
            }`}
          >
            Recordings
          </button>
        </div>

        {/* Date/time range filter */}
        {tab === "readings" && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-400">From</span>
              <input
                type="datetime-local"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="bg-white border border-neutral-200 rounded-md px-3 py-1.5 text-sm text-neutral-700 focus:outline-none focus:border-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-400">To</span>
              <input
                type="datetime-local"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="bg-white border border-neutral-200 rounded-md px-3 py-1.5 text-sm text-neutral-700 focus:outline-none focus:border-emerald-500"
              />
            </label>
            {(startInput || endInput) && (
              <button
                onClick={() => { setStartInput(""); setEndInput(""); }}
                className="text-xs text-neutral-400 hover:text-neutral-700 transition-colors pb-2"
              >
                Clear
              </button>
            )}
          </div>
        )}

        {/* Readings tab */}
        {tab === "readings" && (
          <div className="space-y-1 font-mono text-sm">
            {readings.map((r) => (
              <div
                key={r._id}
                className="flex justify-between text-neutral-700 bg-neutral-50 rounded px-3 py-2"
              >
                <span>
                  {r.value.toFixed(1)} <span className="text-neutral-400">dB</span>
                  <span className="text-neutral-400 ml-3 text-xs">{r.raw_text}</span>
                </span>
                <span className="text-neutral-400 text-xs">{formatTime(r.timestamp)}</span>
              </div>
            ))}
            {readings.length === 0 && (
              <div className="text-neutral-400 text-xs">No readings yet...</div>
            )}
            {status === "CanLoadMore" && (
              <button
                onClick={() => loadMore(50)}
                className="w-full mt-4 py-2 rounded-lg bg-neutral-100 text-neutral-600 hover:bg-neutral-200 text-sm transition-colors"
              >
                Load More
              </button>
            )}
            {status === "LoadingMore" && (
              <div className="text-center text-neutral-400 text-xs mt-4">Loading...</div>
            )}
          </div>
        )}

        {/* Recordings tab */}
        {tab === "recordings" && (
          <div className="space-y-5">
            {dayGroups.map((day) => (
              <div key={day.label}>
                <h3 className="text-xs font-medium text-neutral-400 uppercase tracking-wide mb-2">
                  {day.label}
                </h3>
                <div className="space-y-1">
                  {day.items.map((group) => {
                    const isMultiSegment = group.segments.length > 1;
                    const lastSegment = group.segments[group.segments.length - 1];
                    const endTime = lastSegment.startedAt + (lastSegment.durationMs ?? 0);
                    const timeRange = `${formatTimeShort(group.startedAt)} – ${formatTimeShort(endTime)}`;
                    const linkTo = isMultiSegment
                      ? `/session/${group.key}`
                      : `/recording/${group.segments[0]._id}`;

                    return (
                      <Link
                        key={group.key}
                        to={linkTo}
                        className="flex justify-between items-center bg-neutral-50 hover:bg-neutral-100 rounded px-3 py-2 transition-colors"
                      >
                        <span className="text-sm text-neutral-700 flex items-center gap-2">
                          {isMultiSegment ? timeRange : formatTimeShort(group.startedAt)}
                          {isMultiSegment && (
                            <span className="text-[10px] text-neutral-400">
                              {group.segments.length} segments · {formatDuration(group.totalDurationMs)}
                            </span>
                          )}
                        </span>
                        {!isMultiSegment && group.totalDurationMs > 0 && (
                          <span className="text-xs text-neutral-400">
                            {formatDuration(group.totalDurationMs)}
                          </span>
                        )}
                      </Link>
                    );
                  })}
                </div>
              </div>
            ))}
            {sessionGroups.length === 0 && (
              <div className="text-neutral-400 text-xs">No recordings yet...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
