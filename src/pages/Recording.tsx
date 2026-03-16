import { useEffect, useState } from "react";
import { useAction, useQuery } from "convex/react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

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

export default function Recording() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const recording = useQuery(api.recordings.getRecording, {
    recordingId: id as Id<"recordings">,
  });
  const sessionRecordings = useQuery(
    api.recordings.getSessionRecordings,
    recording?.sessionId ? { sessionId: recording.sessionId } : "skip",
  );
  const getDownloadUrl = useAction(api.s3.getDownloadUrl);
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    setUrl(null);
  }, [id]);

  useEffect(() => {
    if (recording?.s3Key && !url) {
      getDownloadUrl({ s3Key: recording.s3Key }).then(setUrl);
    }
  }, [recording, url]);

  const totalSegments = sessionRecordings?.length ?? 0;
  const currentSegmentIndex = recording?.segmentIndex ?? 0;
  const prevSegment = sessionRecordings?.find(
    (r) => (r.segmentIndex ?? 0) === currentSegmentIndex - 1,
  );
  const nextSegment = sessionRecordings?.find(
    (r) => (r.segmentIndex ?? 0) === currentSegmentIndex + 1,
  );

  return (
    <div className="min-h-screen bg-white text-neutral-900 p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <Link
          to="/history"
          className="text-sm text-neutral-400 hover:text-neutral-700 transition-colors mb-4 inline-block"
        >
          ← Back to History
        </Link>

        {!recording ? (
          <div className="text-neutral-400 text-sm">Loading...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <h1 className="text-2xl font-bold">
                {formatTime(recording.startedAt)}
              </h1>
              <div className="flex items-center gap-3 mt-1">
                {recording.durationMs && (
                  <span className="text-sm text-neutral-400">
                    {formatDuration(recording.durationMs)}
                  </span>
                )}
                {totalSegments > 1 && (
                  <span className="text-xs text-neutral-400">
                    {currentSegmentIndex + 1} / {totalSegments}
                  </span>
                )}
              </div>
            </div>

            {url ? (
              <>
                <div className="rounded-lg overflow-hidden border border-neutral-200">
                  <video
                    src={url}
                    controls
                    preload="metadata"
                    className="w-full"
                    style={{ maxHeight: 480 }}
                    onLoadedMetadata={(e) => {
                      const video = e.currentTarget;
                      if (!isFinite(video.duration)) {
                        video.currentTime = 1e101;
                        video.addEventListener(
                          "timeupdate",
                          function handler() {
                            video.currentTime = 0;
                            video.removeEventListener("timeupdate", handler);
                          },
                        );
                      }
                    }}
                  />
                </div>

                {/* Segment navigation */}
                {totalSegments > 1 && (
                  <div className="flex items-center gap-3">
                    <button
                      disabled={!prevSegment}
                      onClick={() => prevSegment && navigate(`/recording/${prevSegment._id}`)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 disabled:opacity-30 transition-colors"
                    >
                      ← Previous Segment
                    </button>
                    <button
                      disabled={!nextSegment}
                      onClick={() => nextSegment && navigate(`/recording/${nextSegment._id}`)}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 disabled:opacity-30 transition-colors"
                    >
                      Next Segment →
                    </button>
                  </div>
                )}

                <a
                  href={url}
                  download
                  className="inline-block px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white transition-colors"
                >
                  Download
                </a>
              </>
            ) : (
              <div className="text-neutral-400 text-xs">Loading video...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
