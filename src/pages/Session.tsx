import { useQuery } from "convex/react";
import { Link, useParams } from "react-router-dom";
import { api } from "../../convex/_generated/api";

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

export default function Session() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const segments = useQuery(
    api.recordings.getSessionRecordings,
    sessionId ? { sessionId } : "skip"
  );

  if (!segments) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
        <div className="w-full max-w-3xl">
          <div className="text-neutral-400 text-sm">Loading...</div>
        </div>
      </div>
    );
  }

  if (segments.length === 0) {
    return (
      <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
        <div className="w-full max-w-3xl">
          <Link
            to="/history"
            className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-4 inline-block"
          >
            ← Back to History
          </Link>
          <div className="text-neutral-400 text-sm">No segments found for this session.</div>
        </div>
      </div>
    );
  }

  const firstSegment = segments[0];
  const lastSegment = segments[segments.length - 1];
  const sessionStart = firstSegment.startedAt;
  const sessionEnd = lastSegment.startedAt + (lastSegment.durationMs ?? 0);
  const totalDurationMs = segments.reduce((sum, s) => sum + (s.durationMs ?? 0), 0);

  // Group into hourly blocks of 6 segments each
  const blocks: (typeof segments)[] = [];
  for (let i = 0; i < segments.length; i += 6) {
    blocks.push(segments.slice(i, i + 6));
  }
  const showBlockHeaders = blocks.length > 1;

  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <Link
          to="/history"
          className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-4 inline-block"
        >
          ← Back to History
        </Link>

        <h1 className="text-2xl font-bold mb-1">
          {formatTimeShort(sessionStart)} – {formatTimeShort(sessionEnd)}
        </h1>
        <p className="text-sm text-neutral-400 mb-6">
          {segments.length} segments · {formatDuration(totalDurationMs)}
        </p>

        <div className="space-y-6">
          {blocks.map((block, blockIndex) => {
            const blockStart = block[0].startedAt;
            const blockLast = block[block.length - 1];
            const blockEnd = blockLast.startedAt + (blockLast.durationMs ?? 0);

            return (
              <div key={blockIndex}>
                {showBlockHeaders && (
                  <h2 className="text-sm font-semibold text-neutral-500 mb-2">
                    Hour {blockIndex + 1} ({formatTimeShort(blockStart)} – {formatTimeShort(blockEnd)})
                  </h2>
                )}
                <div className="space-y-1">
                  {block.map((segment, segIndex) => {
                    const globalIndex = blockIndex * 6 + segIndex;
                    return (
                      <Link
                        key={segment._id}
                        to={`/recording/${segment._id}`}
                        className="flex items-center bg-neutral-50 hover:bg-neutral-100 rounded px-3 py-2 transition-colors text-sm text-neutral-700"
                      >
                        <span>
                          Segment {globalIndex + 1} · {formatTimeShort(segment.startedAt)}
                          {segment.durationMs != null && (
                            <span className="text-neutral-400"> · {formatDuration(segment.durationMs)}</span>
                          )}
                        </span>
                      </Link>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
