import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAction, usePaginatedQuery, useQuery } from "convex/react";
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

function formatPlayerTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

function AudioPlayer({ src }: { src: string }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => { if (!dragging) setCurrentTime(audio.currentTime); };
    const onMeta = () => setDuration(audio.duration);
    const onEnd = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onMeta);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onMeta);
      audio.removeEventListener("ended", onEnd);
    };
  }, [dragging]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (playing) { audio.pause(); } else { audio.play(); }
    setPlaying(!playing);
  };

  const seekTo = useCallback((clientX: number) => {
    const track = trackRef.current;
    const audio = audioRef.current;
    if (!track || !audio || !duration) return;
    const rect = track.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const time = ratio * duration;
    audio.currentTime = time;
    setCurrentTime(time);
  }, [duration]);

  const onPointerDown = (e: React.PointerEvent) => {
    setDragging(true);
    seekTo(e.clientX);
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragging) return;
    seekTo(e.clientX);
  };

  const onPointerUp = () => {
    setDragging(false);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  const skipBack = () => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = Math.max(0, audio.currentTime - 10); }
  };

  const skipForward = () => {
    const audio = audioRef.current;
    if (audio) { audio.currentTime = Math.min(duration, audio.currentTime + 10); }
  };

  return (
    <div className="w-full">
      <audio ref={audioRef} src={src} preload="metadata" />

      {/* Timeline track */}
      <div
        ref={trackRef}
        className="group relative h-6 flex items-center cursor-pointer select-none"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
      >
        {/* Background bar */}
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-neutral-700 group-hover:h-2 transition-all" />
        {/* Progress fill */}
        <div
          className="absolute left-0 h-1.5 rounded-full bg-emerald-500 group-hover:h-2 transition-all"
          style={{ width: `${progress}%` }}
        />
        {/* Thumb */}
        <div
          className="absolute w-3.5 h-3.5 rounded-full bg-white shadow-md shadow-black/30 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ left: `${progress}%` }}
        />
      </div>

      {/* Controls row */}
      <div className="flex items-center justify-between mt-1">
        <span className="text-[11px] text-neutral-500 font-mono w-10">
          {formatPlayerTime(currentTime)}
        </span>

        <div className="flex items-center gap-3">
          {/* Skip back 10s */}
          <button
            onClick={skipBack}
            className="text-neutral-400 hover:text-white transition-colors"
            title="Back 10s"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 17a5 5 0 1 0 0-10" />
              <polyline points="11 12 11 7" />
              <polyline points="7 10 11 7 11 12" />
              <text x="13" y="15" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">10</text>
            </svg>
          </button>

          {/* Play / Pause */}
          <button
            onClick={togglePlay}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-emerald-500 hover:bg-emerald-400 transition-colors text-black"
          >
            {playing ? (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <rect x="6" y="4" width="4" height="16" rx="1" />
                <rect x="14" y="4" width="4" height="16" rx="1" />
              </svg>
            ) : (
              <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                <polygon points="6,3 20,12 6,21" />
              </svg>
            )}
          </button>

          {/* Skip forward 10s */}
          <button
            onClick={skipForward}
            className="text-neutral-400 hover:text-white transition-colors"
            title="Forward 10s"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 17a5 5 0 1 0 0-10" />
              <polyline points="13 12 13 7" />
              <polyline points="17 10 13 7 13 12" />
              <text x="4" y="15" fontSize="7" fill="currentColor" stroke="none" fontFamily="sans-serif">10</text>
            </svg>
          </button>
        </div>

        <span className="text-[11px] text-neutral-500 font-mono w-10 text-right">
          {duration > 0 ? formatPlayerTime(duration) : "--:--"}
        </span>
      </div>
    </div>
  );
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
  const getDownloadUrl = useAction(api.s3.getDownloadUrl);
  const [resolvedUrls, setResolvedUrls] = useState<Record<string, string>>({});

  // Resolve S3 download URLs when recordings load
  useEffect(() => {
    if (!recordings) return;
    for (const r of recordings) {
      if (r.s3Key && !resolvedUrls[r._id]) {
        getDownloadUrl({ s3Key: r.s3Key }).then((url) => {
          setResolvedUrls((prev) => ({ ...prev, [r._id]: url }));
        });
      }
    }
  }, [recordings]);

  return (
    <div className="min-h-screen bg-neutral-950 text-white p-6 flex flex-col items-center">
      <div className="w-full max-w-3xl">
        <Link
          to="/"
          className="text-sm text-neutral-400 hover:text-white transition-colors mb-4 inline-block"
        >
          ← Back
        </Link>

        <h1 className="text-2xl font-bold mb-6">History</h1>

        {/* Tabs */}
        <div className="flex gap-1 mb-6 bg-neutral-900 rounded-lg p-1 w-fit">
          <button
            onClick={() => setTab("readings")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "readings"
                ? "bg-emerald-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Readings
          </button>
          <button
            onClick={() => setTab("recordings")}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === "recordings"
                ? "bg-emerald-600 text-white"
                : "text-neutral-400 hover:text-white"
            }`}
          >
            Recordings
          </button>
        </div>

        {/* Date/time range filter */}
        {tab === "readings" && (
          <div className="mb-4 flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500">From</span>
              <input
                type="datetime-local"
                value={startInput}
                onChange={(e) => setStartInput(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-xs text-neutral-500">To</span>
              <input
                type="datetime-local"
                value={endInput}
                onChange={(e) => setEndInput(e.target.value)}
                className="bg-neutral-800 border border-neutral-700 rounded-md px-3 py-1.5 text-sm text-neutral-200 focus:outline-none focus:border-emerald-500"
              />
            </label>
            {(startInput || endInput) && (
              <button
                onClick={() => { setStartInput(""); setEndInput(""); }}
                className="text-xs text-neutral-400 hover:text-white transition-colors pb-2"
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
                className="flex justify-between text-neutral-300 bg-neutral-900 rounded px-3 py-2"
              >
                <span>
                  {r.value.toFixed(1)} <span className="text-neutral-500">dB</span>
                  <span className="text-neutral-600 ml-3 text-xs">{r.raw_text}</span>
                </span>
                <span className="text-neutral-500 text-xs">{formatTime(r.timestamp)}</span>
              </div>
            ))}
            {readings.length === 0 && (
              <div className="text-neutral-600 text-xs">No readings yet...</div>
            )}
            {status === "CanLoadMore" && (
              <button
                onClick={() => loadMore(50)}
                className="w-full mt-4 py-2 rounded-lg bg-neutral-800 text-neutral-300 hover:bg-neutral-700 text-sm transition-colors"
              >
                Load More
              </button>
            )}
            {status === "LoadingMore" && (
              <div className="text-center text-neutral-500 text-xs mt-4">Loading...</div>
            )}
          </div>
        )}

        {/* Recordings tab */}
        {tab === "recordings" && (
          <div className="space-y-3">
            {recordings?.map((r) => {
              const url = resolvedUrls[r._id];
              return (
                <div
                  key={r._id}
                  className="bg-neutral-900 rounded-xl p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-neutral-300">
                        {formatTime(r.startedAt)}
                      </div>
                      {r.durationMs && (
                        <div className="text-xs text-neutral-500">
                          {formatDuration(r.durationMs)}
                        </div>
                      )}
                    </div>
                    {url && (
                      <a
                        href={url}
                        download
                        className="text-xs text-emerald-400 hover:text-emerald-300 transition-colors"
                      >
                        Download
                      </a>
                    )}
                  </div>
                  {url ? (
                    <AudioPlayer src={url} />
                  ) : r.s3Key ? (
                    <div className="text-neutral-600 text-xs">Loading player...</div>
                  ) : null}
                </div>
              );
            })}
            {(!recordings || recordings.length === 0) && (
              <div className="text-neutral-600 text-xs">No recordings yet...</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
