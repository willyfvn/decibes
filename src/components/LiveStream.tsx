import { useState, useRef, useEffect } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLiveKit } from "../hooks/useLiveKit";

const ROOM_NAME = "decibes-main";

export default function LiveStream() {
  const [viewerName, setViewerName] = useState("");
  const [joining, setJoining] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const generateToken = useAction(api.livekit.generateToken);
  const { isConnected, connect, disconnect, remoteVideoTracks } = useLiveKit();

  // Attach the first remote video track to the video element
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const tracks = Array.from(remoteVideoTracks.values());
    if (tracks.length > 0) {
      const stream = new MediaStream([tracks[0]]);
      video.srcObject = stream;
      video.play().catch(() => {});
    } else {
      video.srcObject = null;
    }
  }, [remoteVideoTracks]);

  const handleJoin = async () => {
    if (!viewerName.trim()) return;
    setJoining(true);
    setError(null);
    try {
      const token = await generateToken({
        roomName: ROOM_NAME,
        participantName: viewerName.trim(),
        canPublish: false,
      });
      await connect(token);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setJoining(false);
    }
  };

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center gap-3">
        <h2 className="text-lg font-semibold text-neutral-300">Watch Live</h2>
        <input
          type="text"
          placeholder="Your name"
          value={viewerName}
          onChange={(e) => setViewerName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleJoin()}
          className="px-3 py-2 rounded-lg bg-neutral-800 border border-neutral-700 text-white text-sm w-48 focus:outline-none focus:border-emerald-500"
        />
        <button
          onClick={handleJoin}
          disabled={joining || !viewerName.trim()}
          className="px-4 py-2 rounded-lg text-sm font-medium bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-50 transition-colors"
        >
          {joining ? "Joining..." : "Join as Viewer"}
        </button>
        {error && <div className="text-red-400 text-xs">{error}</div>}
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative rounded-lg overflow-hidden border border-neutral-700" style={{ width: 320, height: 240 }}>
        <video
          ref={videoRef}
          className="w-full h-full object-contain bg-black"
          playsInline
          muted
        />
        {remoteVideoTracks.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/60">
            <span className="text-neutral-400 text-sm">Waiting for broadcaster...</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2">
        <span className="text-emerald-400 text-xs font-medium">Connected as {viewerName}</span>
        <button
          onClick={disconnect}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-600 hover:bg-red-700 text-white transition-colors"
        >
          Leave
        </button>
      </div>
    </div>
  );
}
