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

function formatDuration(ms: number) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remaining = seconds % 60;
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
          <div className="space-y-1">
            {recordings?.map((r) => (
              <Link
                key={r._id}
                to={`/recording/${r._id}`}
                className="flex justify-between items-center bg-neutral-50 hover:bg-neutral-100 rounded px-3 py-2 transition-colors"
              >
                <span className="text-sm text-neutral-700">
                  {formatTime(r.startedAt)}
                </span>
                {r.durationMs && (
                  <span className="text-xs text-neutral-400">
                    {formatDuration(r.durationMs)}
                  </span>
                )}
              </Link>
            ))}
            {(!recordings || recordings.length === 0) && (
              <div className="text-neutral-400 text-xs">No recordings yet...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
