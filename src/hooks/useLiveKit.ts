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
}

export function useLiveKit(options?: UseLiveKitOptions) {
  const roomRef = useRef<Room | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [remoteVideoTracks, setRemoteVideoTracks] = useState<
    Map<string, MediaStreamTrack>
  >(new Map());

  const connect = useCallback(
    async (token: string, mediaStream?: MediaStream) => {
      if (roomRef.current) return;

      const room = new Room({
        adaptiveStream: true,
        dynacast: true,
        videoCaptureDefaults: {
          resolution: VideoPresets.h360.resolution,
        },
      });

      room.on(RoomEvent.Connected, () => setIsConnected(true));
      room.on(RoomEvent.Disconnected, () => {
        setIsConnected(false);
        roomRef.current = null;
        setRemoteVideoTracks(new Map());
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
