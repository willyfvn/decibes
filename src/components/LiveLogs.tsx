import { useQuery } from "convex/react";
import { Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";

function formatTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

export default function LiveLogs() {
  const readings = useQuery(api.readings.getRecentReadings);

  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4 flex flex-col h-full shadow-sm">
      <h2 className="text-sm font-semibold text-neutral-500 uppercase tracking-wider mb-3">
        Live Logs
      </h2>

      <div className="flex-1 overflow-y-auto space-y-1 font-mono text-sm">
        {readings?.map((r) => (
          <div
            key={r._id}
            className="flex justify-between text-neutral-700 px-1 animate-flash"
          >
            <span>
              {r.value.toFixed(1)} <span className="text-neutral-400">dB</span>
            </span>
            <span className="text-neutral-400">{formatTime(r.timestamp)}</span>
          </div>
        ))}
        {(!readings || readings.length === 0) && (
          <div className="text-neutral-400 text-xs">No readings yet...</div>
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
