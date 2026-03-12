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
    <div className="rounded-2xl border border-neutral-700 bg-neutral-900 p-4 flex flex-col h-full">
      <h2 className="text-sm font-semibold text-neutral-400 uppercase tracking-wider mb-3">
        Live Logs
      </h2>

      <div className="flex-1 overflow-y-auto space-y-1 font-mono text-sm">
        {readings?.map((r) => (
          <div
            key={r._id}
            className="flex justify-between text-neutral-300 px-1"
          >
            <span>
              {r.value.toFixed(1)} <span className="text-neutral-500">dB</span>
            </span>
            <span className="text-neutral-500">{formatTime(r.timestamp)}</span>
          </div>
        ))}
        {(!readings || readings.length === 0) && (
          <div className="text-neutral-600 text-xs">No readings yet...</div>
        )}
      </div>

      <Link
        to="/history"
        className="mt-3 text-center text-sm text-emerald-400 hover:text-emerald-300 transition-colors"
      >
        View History →
      </Link>
    </div>
  );
}
