import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useRef, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import fixWebmDuration from "fix-webm-duration";

interface RecordingControlsProps {
  roomName: string;
  mediaStream: MediaStream | null;
  onStopLive?: () => Promise<void> | void;
}

export default function RecordingControls({ roomName, mediaStream, onStopLive }: RecordingControlsProps) {
  const [recording, setRecording] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<Id<"recordings"> | null>(null);
  const startTimeRef = useRef<number>(0);

  const activeRecording = useQuery(api.recordings.getActiveRecording, { roomName });
  const startRecordingMut = useMutation(api.recordings.startRecording);
  const finishRecordingMut = useMutation(api.recordings.finishRecording);
  const failRecordingMut = useMutation(api.recordings.failRecording);
  const getUploadUrl = useAction(api.s3.getUploadUrl);

  const handleStart = async () => {
    if (!mediaStream) return;
    setError(null);

    try {
      const recordingId = await startRecordingMut({ roomName });
      recordingIdRef.current = recordingId;
      startTimeRef.current = Date.now();
      chunksRef.current = [];

      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
        ? "video/webm;codecs=vp9"
        : "video/webm";

      const recorder = new MediaRecorder(mediaStream, { mimeType });
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onerror = () => {
        setError("Recording failed");
        setRecording(false);
        if (recordingIdRef.current) {
          failRecordingMut({ recordingId: recordingIdRef.current });
        }
      };

      recorder.start(1000);
      recorderRef.current = recorder;
      setRecording(true);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleStop = async () => {
    const recorder = recorderRef.current;
    const recordingId = recordingIdRef.current;

    // If we have a local recorder, stop it and upload
    if (recorder && recordingId) {
      setRecording(false);
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        });

        const durationMs = Date.now() - startTimeRef.current;
        const rawBlob = new Blob(chunksRef.current, { type: recorder.mimeType });
        const blob = await fixWebmDuration(rawBlob, durationMs, { logger: false });

        const { uploadUrl, s3Key } = await getUploadUrl({
          recordingId,
          contentType: blob.type,
        });

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("PUT", uploadUrl);
          xhr.setRequestHeader("Content-Type", blob.type);

          xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) {
              setUploadProgress(Math.round((e.loaded / e.total) * 100));
            }
          };

          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) resolve();
            else reject(new Error(`Upload failed: ${xhr.status}`));
          };
          xhr.onerror = () => reject(new Error("Upload failed"));

          xhr.send(blob);
        });

        await finishRecordingMut({ recordingId, s3Key, durationMs });
      } catch (err) {
        setError((err as Error).message);
        await failRecordingMut({ recordingId });
      } finally {
        setUploading(false);
        setUploadProgress(0);
        recorderRef.current = null;
        recordingIdRef.current = null;
        chunksRef.current = [];
      }
    } else if (activeRecording) {
      // Stale DB recording with no local recorder — mark it failed
      await failRecordingMut({ recordingId: activeRecording._id });
    }

    // Also stop the live stream
    if (onStopLive) {
      await onStopLive();
    }
  };

  const isRecording = recording || !!activeRecording;

  return (
    <div className="flex items-center gap-2">
      {uploading ? (
        <span className="text-amber-600 text-xs font-medium">
          Uploading... {uploadProgress}%
        </span>
      ) : isRecording ? (
        <>
          <span className="flex items-center gap-1.5 text-red-500 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            Recording
          </span>
          <button
            onClick={handleStop}
            className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-500 hover:bg-red-600 text-white transition-colors"
          >
            Stop Recording
          </button>
        </>
      ) : (
        <button
          onClick={handleStart}
          disabled={!mediaStream}
          className="px-3 py-1.5 rounded-lg text-xs font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 disabled:opacity-50 transition-colors"
        >
          Record
        </button>
      )}
      {error && <span className="text-red-500 text-[10px]">{error}</span>}
    </div>
  );
}
