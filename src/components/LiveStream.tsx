import { useRef, useEffect, useState } from "react";
import { useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLiveKit } from "../hooks/useLiveKit";

const ROOM_NAME = "decibes-main";

export default function LiveStream() {
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const hasJoined = useRef(false);

  const generateToken = useAction(api.livekit.generateToken);
  const { isConnected, connect, remoteVideoTracks } = useLiveKit();

  // Auto-join on mount
  useEffect(() => {
    if (hasJoined.current) return;
    hasJoined.current = true;

    const join = async () => {
      try {
        const token = await generateToken({
          roomName: ROOM_NAME,
          participantName: `viewer-${Date.now()}`,
          canPublish: false,
        });
        await connect(token);
      } catch (err) {
        setError((err as Error).message);
      }
    };
    join();
  }, [generateToken, connect]);

  // Attach remote video track
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

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative rounded-xl overflow-hidden border border-neutral-200 bg-neutral-50"
        style={{ width: 480, height: 360 }}
      >
        <video
          ref={videoRef}
          className="w-full h-full object-contain"
          playsInline
          muted
        />
        {remoteVideoTracks.size === 0 && (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-neutral-400 text-sm">
              {isConnected ? "Waiting for broadcast..." : "Connecting..."}
            </span>
          </div>
        )}
      </div>
      {error && <div className="text-red-500 text-xs">{error}</div>}
    </div>
  );
}
