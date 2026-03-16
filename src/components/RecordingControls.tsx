import { useAction, useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useEffect, useRef, useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import fixWebmDuration from "fix-webm-duration";

const ROTATION_INTERVAL_MS = 10 * 60 * 1000; // 10 minutes

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
  const [segmentIndex, setSegmentIndex] = useState(0);
  const [uploadingPrevSegment, setUploadingPrevSegment] = useState(false);
  const [segmentRemaining, setSegmentRemaining] = useState(ROTATION_INTERVAL_MS);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingIdRef = useRef<Id<"recordings"> | null>(null);
  const startTimeRef = useRef<number>(0);
  const sessionIdRef = useRef<string | null>(null);
  const segmentIndexRef = useRef(0);
  const rotationTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isRotatingRef = useRef(false);
  const segmentStartTimeRef = useRef<number>(0);
  const mediaStreamRef = useRef(mediaStream);

  // Keep mediaStream ref current
  useEffect(() => {
    mediaStreamRef.current = mediaStream;
  }, [mediaStream]);

  const activeRecording = useQuery(api.recordings.getActiveRecording, { roomName });
  const startRecordingMut = useMutation(api.recordings.startRecording);
  const finishRecordingMut = useMutation(api.recordings.finishRecording);
  const failRecordingMut = useMutation(api.recordings.failRecording);
  const getUploadUrl = useAction(api.s3.getUploadUrl);

  // Store mutation/action refs so interval callbacks always use latest
  const startRecordingMutRef = useRef(startRecordingMut);
  const finishRecordingMutRef = useRef(finishRecordingMut);
  const failRecordingMutRef = useRef(failRecordingMut);
  const getUploadUrlRef = useRef(getUploadUrl);

  useEffect(() => { startRecordingMutRef.current = startRecordingMut; }, [startRecordingMut]);
  useEffect(() => { finishRecordingMutRef.current = finishRecordingMut; }, [finishRecordingMut]);
  useEffect(() => { failRecordingMutRef.current = failRecordingMut; }, [failRecordingMut]);
  useEffect(() => { getUploadUrlRef.current = getUploadUrl; }, [getUploadUrl]);

  const getMimeType = () =>
    MediaRecorder.isTypeSupported("video/webm;codecs=vp9")
      ? "video/webm;codecs=vp9"
      : "video/webm";

  async function startNewRecorder(): Promise<{
    recorder: MediaRecorder;
    recordingId: Id<"recordings">;
    chunks: Blob[];
    startTime: number;
  }> {
    const stream = mediaStreamRef.current;
    if (!stream) throw new Error("No media stream");

    // Clone the stream so MediaRecorder gets its own tracks
    // (LiveKit may take ownership of the original tracks)
    const clonedStream = stream.clone();

    const sessionId = sessionIdRef.current!;
    const idx = segmentIndexRef.current;

    const recordingId = await startRecordingMutRef.current({
      roomName,
      sessionId,
      segmentIndex: idx,
    });

    const chunks: Blob[] = [];
    const mimeType = getMimeType();
    const recorder = new MediaRecorder(clonedStream, { mimeType });

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    recorder.onerror = () => {
      setError("Recording failed");
      setRecording(false);
      failRecordingMutRef.current({ recordingId });
    };

    recorder.start(1000);
    const startTime = Date.now();

    return { recorder, recordingId, chunks, startTime };
  }

  async function uploadSegment(
    recorder: MediaRecorder,
    recordingId: Id<"recordings">,
    chunks: Blob[],
    segStartTime: number,
    options?: { showMainProgress?: boolean },
  ) {
    const showMain = options?.showMainProgress ?? false;

    try {
      // Only stop if still recording
      if (recorder.state === "recording") {
        await new Promise<void>((resolve) => {
          recorder.onstop = () => resolve();
          recorder.stop();
        });
      }

      // Stop cloned tracks to avoid leaks
      recorder.stream.getTracks().forEach((t) => t.stop());

      const durationMs = Date.now() - segStartTime;
      const rawBlob = new Blob(chunks, { type: recorder.mimeType });
      const blob = await fixWebmDuration(rawBlob, durationMs, { logger: false });

      const { uploadUrl, s3Key } = await getUploadUrlRef.current({
        recordingId,
        contentType: blob.type,
      });

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl);
        xhr.setRequestHeader("Content-Type", blob.type);

        xhr.upload.onprogress = (e) => {
          if (e.lengthComputable && showMain) {
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

      await finishRecordingMutRef.current({ recordingId, s3Key, durationMs });
    } catch (err) {
      console.error("Segment upload failed:", err);
      await failRecordingMutRef.current({ recordingId });
      throw err;
    }
  }

  async function rotate() {
    if (isRotatingRef.current || !mediaStreamRef.current) return;
    isRotatingRef.current = true;

    const oldRecorder = recorderRef.current;
    const oldRecordingId = recordingIdRef.current;
    const oldChunks = [...chunksRef.current]; // snapshot
    const oldStartTime = segmentStartTimeRef.current;

    try {
      // Start new segment FIRST (overlap, no gap)
      segmentIndexRef.current += 1;
      const newSeg = await startNewRecorder();

      recorderRef.current = newSeg.recorder;
      recordingIdRef.current = newSeg.recordingId;
      chunksRef.current = newSeg.chunks;
      segmentStartTimeRef.current = newSeg.startTime;
      setSegmentIndex(segmentIndexRef.current);

      // Upload old segment in background
      if (oldRecorder && oldRecordingId) {
        setUploadingPrevSegment(true);
        uploadSegment(oldRecorder, oldRecordingId, oldChunks, oldStartTime)
          .catch(() => {/* already handled in uploadSegment */})
          .finally(() => setUploadingPrevSegment(false));
      }
    } catch (err) {
      setError("Rotation failed: " + (err as Error).message);
    } finally {
      isRotatingRef.current = false;
    }
  }

  // Store rotate in a ref so setInterval always calls the latest version
  const rotateRef = useRef(rotate);
  useEffect(() => {
    rotateRef.current = rotate;
  });

  const handleStart = async () => {
    if (!mediaStream) return;
    setError(null);

    try {
      sessionIdRef.current = crypto.randomUUID();
      segmentIndexRef.current = 0;

      const seg = await startNewRecorder();
      recorderRef.current = seg.recorder;
      recordingIdRef.current = seg.recordingId;
      chunksRef.current = seg.chunks;
      startTimeRef.current = seg.startTime;
      segmentStartTimeRef.current = seg.startTime;
      setSegmentIndex(0);
      setRecording(true);

      // Check every 30s if rotation is due — browsers throttle long intervals in background tabs
      rotationTimerRef.current = setInterval(() => {
        if (segmentStartTimeRef.current && Date.now() - segmentStartTimeRef.current >= ROTATION_INTERVAL_MS) {
          rotateRef.current();
        }
      }, 30_000);
    } catch (err) {
      setError((err as Error).message);
    }
  };

  const handleStop = async () => {
    // Clear rotation timer
    if (rotationTimerRef.current) {
      clearInterval(rotationTimerRef.current);
      rotationTimerRef.current = null;
    }

    const recorder = recorderRef.current;
    const recordingId = recordingIdRef.current;

    if (recorder && recordingId) {
      setRecording(false);
      setUploading(true);
      setUploadProgress(0);
      setError(null);

      try {
        await uploadSegment(
          recorder,
          recordingId,
          chunksRef.current,
          segmentStartTimeRef.current,
          { showMainProgress: true },
        );
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setUploading(false);
        setUploadProgress(0);
        recorderRef.current = null;
        recordingIdRef.current = null;
        chunksRef.current = [];
        sessionIdRef.current = null;
      }
    } else if (activeRecording) {
      await failRecordingMut({ recordingId: activeRecording._id });
    }

    if (onStopLive) {
      await onStopLive();
    }
  };

  const isRecording = recording || !!activeRecording;

  // Countdown timer for segment remaining time
  useEffect(() => {
    if (!isRecording || !segmentStartTimeRef.current) {
      setSegmentRemaining(ROTATION_INTERVAL_MS);
      return;
    }
    // Tick immediately, then every second
    const tick = () => {
      const elapsed = Date.now() - segmentStartTimeRef.current;
      setSegmentRemaining(Math.max(0, ROTATION_INTERVAL_MS - elapsed));
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [isRecording, segmentIndex]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (rotationTimerRef.current) {
        clearInterval(rotationTimerRef.current);
      }
    };
  }, []);

  // Visibility change: rotate if overdue when tab regains focus
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === "visible" && segmentStartTimeRef.current && recorderRef.current) {
        const elapsed = Date.now() - segmentStartTimeRef.current;
        if (elapsed >= ROTATION_INTERVAL_MS) {
          rotateRef.current();
        }
      }
    };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

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
            Recording{segmentIndex > 0 ? ` (segment ${segmentIndex + 1})` : ""}
            <span className="text-neutral-400 font-normal tabular-nums">
              {Math.floor(segmentRemaining / 60000)}:{String(Math.floor((segmentRemaining % 60000) / 1000)).padStart(2, "0")}
            </span>
          </span>
          {uploadingPrevSegment && (
            <span className="text-amber-600 text-[10px]">Uploading previous segment...</span>
          )}
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
