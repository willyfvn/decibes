import { useRef, useState, useCallback } from "react";
import {
  Room,
  RoomEvent,
  LocalVideoTrack,
  Track,
  RemoteTrackPublication,
  RemoteParticipant,
  VideoPresets,
} from "livekit-client";

const LIVEKIT_URL = import.meta.env.VITE_LIVEKIT_URL as string;

interface UseLiveKitOptions {
  onRemoteTrack?: (track: MediaStreamTrack, participant: RemoteParticipant) => void;
  onRemoteTrackRemoved?: (participant: RemoteParticipant) => void;
  autoReconnect?: boolean;
}

export function useLiveKit(options?: UseLiveKitOptions) {
  const roomRef = useRef<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteVideoTracks, setRemoteVideoTracks] = useState<
    Map<string, MediaStreamTrack>
  >(new Map());

  const tokenRef = useRef<string | null>(null);
  const mediaStreamRef = useRef<MediaStream | undefined>(undefined);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectAttemptRef = useRef(0);
  const intentionalDisconnectRef = useRef(false);

  const connect = useCallback(
    async (token: string, mediaStream?: MediaStream) => {
      if (roomRef.current) return;

      // Store for reconnection
      tokenRef.current = token;
      mediaStreamRef.current = mediaStream;
      intentionalDisconnectRef.current = false;
      reconnectAttemptRef.current = 0;

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h360.resolution,
        },
      });

      room.on(RoomEvent.Connected, () => {
        setIsConnected(true);
        reconnectAttemptRef.current = 0;
      });

      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        roomRef.current = null;
        setRemoteVideoTracks(new Map());

        // Auto-reconnect if enabled and not intentionally disconnected
        if (options?.autoReconnect && !intentionalDisconnectRef.current && tokenRef.current) {
          const attempt = reconnectAttemptRef.current;
          const delay = Math.min(5000 * Math.pow(2, attempt), 60000); // 5s, 10s, 20s, 40s, 60s cap
          console.log(`LiveKit disconnected. Reconnecting in ${delay / 1000}s (attempt ${attempt + 1})...`);
          reconnectAttemptRef.current = attempt + 1;

          reconnectTimeoutRef.current = setTimeout(() => {
            if (tokenRef.current && !intentionalDisconnectRef.current) {
              connect(tokenRef.current, mediaStreamRef.current);
            }
          }, delay);
        }
      });

      room.on(
        RoomEvent.TrackSubscribed,
        (track, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Video) {
            const msTrack = track.mediaStreamTrack;
            setRemoteVideoTracks((prev) => {
              const next = new Map(prev);
              next.set(participant.identity, msTrack);
              return next;
            });
            options?.onRemoteTrack?.(msTrack, participant);
          }
        }
      );

      room.on(
        RoomEvent.TrackUnsubscribed,
        (_track, _pub: RemoteTrackPublication, participant: RemoteParticipant) => {
          setRemoteVideoTracks((prev) => {
            const next = new Map(prev);
            next.delete(participant.identity);
            return next;
          });
          options?.onRemoteTrackRemoved?.(participant);
        }
      );

      await room.connect(LIVEKIT_URL, token);
      roomRef.current = room;

      // If a media stream is provided, publish its video track
      if (mediaStream) {
        const videoTrack = mediaStream.getVideoTracks()[0];
        if (videoTrack) {
          const localTrack = new LocalVideoTrack(videoTrack);
          await room.localParticipant.publishTrack(localTrack, {
            videoEncoding: {
              maxBitrate: 1_500_000,
              maxFramerate: 30,
            },
          });
        }
      }
    },
    [options]
  );

  const disconnect = useCallback(async () => {
    intentionalDisconnectRef.current = true;
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (roomRef.current) {
      await roomRef.current.disconnect();
      roomRef.current = null;
      setIsConnected(false);
      setRemoteVideoTracks(new Map());
    }
  }, []);

  return {
    room: roomRef.current,
    isConnected,
    connect,
    disconnect,
    remoteVideoTracks,
  };
}
