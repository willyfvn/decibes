import { useRef, useState, useCallback, useEffect } from "react";
import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useLiveKit } from "../hooks/useLiveKit";
import RecordingControls from "./RecordingControls";

const OCR_INTERVAL_MS = 10000;
const SAVE_INTERVAL_MS = 10000;

interface CropRegion {
  x: number;
  y: number;
  w: number;
  h: number;
}

const ROOM_NAME = "decibes-main";

export default function WebcamCapture() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const previewRef = useRef<HTMLCanvasElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastOcr, setLastOcr] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropRegion | null>(() => {
    const saved = localStorage.getItem("decibes-crop");
    return saved ? JSON.parse(saved) : null;
  });
  const cropRef = useRef<CropRegion | null>(crop);
  const [cropSaved, setCropSaved] = useState(
    () => !!localStorage.getItem("decibes-crop")
  );
  const [logging, setLogging] = useState(false);
  const [selecting, setSelecting] = useState(false);
  const [goingLive, setGoingLive] = useState(false);
  const [watchUrlCopied, setWatchUrlCopied] = useState(false);
  const dragStart = useRef<{ x: number; y: number } | null>(null);

  const addReading = useMutation(api.readings.addReading);
  const addReadingRef = useRef(addReading);
  addReadingRef.current = addReading;

  const readDisplay = useAction(api.ocr.readDisplay);
  const readDisplayRef = useRef(readDisplay);
  readDisplayRef.current = readDisplay;

  const generateToken = useAction(api.livekit.generateToken);
  const { isConnected: isLive, connect: connectLiveKit, disconnect: disconnectLiveKit } = useLiveKit();

  const busyRef = useRef(false);
  const lastSaveRef = useRef(0);

  const performOcr = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    try {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      if (!video || !canvas || video.readyState < 2) return;

      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(video, 0, 0);

      const c = cropRef.current;
      const sx = c?.x ?? 0;
      const sy = c?.y ?? 0;
      const sw = c?.w ?? canvas.width;
      const sh = c?.h ?? canvas.height;
      const cropCanvas = document.createElement("canvas");
      cropCanvas.width = sw;
      cropCanvas.height = sh;
      const cropCtx = cropCanvas.getContext("2d")!;
      cropCtx.drawImage(canvas, sx, sy, sw, sh, 0, 0, sw, sh);

      if (previewRef.current) {
        previewRef.current.width = sw;
        previewRef.current.height = sh;
        previewRef.current.getContext("2d")?.drawImage(cropCanvas, 0, 0);
      }

      const dataUrl = cropCanvas.toDataURL("image/png");
      const base64 = dataUrl.split(",")[1];

      const result = await readDisplayRef.current({ imageBase64: base64 });
      console.log("OCR result:", result);
      setLastOcr(result.raw_text);

      if (result.value !== null) {
        const now = Date.now();
        if (now - lastSaveRef.current >= SAVE_INTERVAL_MS) {
          lastSaveRef.current = now;
          console.log("Saving reading:", result.value, "dB");
          await addReadingRef.current({
            value: result.value,
            raw_text: result.raw_text,
            timestamp: now,
          });
        }
      }
    } catch (err) {
      console.warn("OCR failed:", err);
    } finally {
      busyRef.current = false;
    }
  }, []);

  const startLogging = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(performOcr, OCR_INTERVAL_MS);
    setLogging(true);
  }, [performOcr]);

  const startCapture = useCallback(async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setStreaming(true);
        if (cropSaved) {
          startLogging();
        }
      }
    } catch (err) {
      setError((err as Error).message);
    }
  }, [performOcr, cropSaved, startLogging]);

  const handleGoLive = useCallback(async () => {
    if (!streamRef.current) return;
    setGoingLive(true);
    try {
      const token = await generateToken({
        roomName: ROOM_NAME,
        participantName: "broadcaster",
        canPublish: true,
      });
      await connectLiveKit(token, streamRef.current);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGoingLive(false);
    }
  }, [generateToken, connectLiveKit]);

  const stopCapture = useCallback(async () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    await disconnectLiveKit();
    const video = videoRef.current;
    if (video?.srcObject) {
      (video.srcObject as MediaStream).getTracks().forEach((t) => t.stop());
      video.srcObject = null;
    }
    streamRef.current = null;
    setStreaming(false);
    setLogging(false);
    setLastOcr(null);
  }, [disconnectLiveKit]);

  // Crop selection — drag on video
  const handleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!selecting) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const video = videoRef.current;
      if (!video) return;
      const scaleX = video.videoWidth / rect.width;
      const scaleY = video.videoHeight / rect.height;
      dragStart.current = {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY,
      };
    },
    [selecting]
  );

  // Auto-save crop on mouseup
  const handleMouseUp = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!selecting || !dragStart.current) return;
      const rect = e.currentTarget.getBoundingClientRect();
      const video = videoRef.current;
      if (!video) return;
      const scaleX = video.videoWidth / rect.width;
      const scaleY = video.videoHeight / rect.height;
      const endX = (e.clientX - rect.left) * scaleX;
      const endY = (e.clientY - rect.top) * scaleY;

      const x = Math.round(Math.min(dragStart.current.x, endX));
      const y = Math.round(Math.min(dragStart.current.y, endY));
      const w = Math.round(Math.abs(endX - dragStart.current.x));
      const h = Math.round(Math.abs(endY - dragStart.current.y));

      if (w > 10 && h > 10) {
        const newCrop = { x, y, w, h };
        setCrop(newCrop);
        cropRef.current = newCrop;
        // Auto-save and start logging
        localStorage.setItem("decibes-crop", JSON.stringify(newCrop));
        setCropSaved(true);
        startLogging();
      }
      dragStart.current = null;
      setSelecting(false);
    },
    [selecting, startLogging]
  );

  const resetCrop = useCallback(() => {
    setCrop(null);
    cropRef.current = null;
    setCropSaved(false);
    localStorage.removeItem("decibes-crop");
    if (intervalRef.current) clearInterval(intervalRef.current);
    setLogging(false);
    setLastOcr(null);
  }, []);

  const copyWatchUrl = useCallback(() => {
    const url = `${window.location.origin}/watch`;
    navigator.clipboard.writeText(url);
    setWatchUrlCopied(true);
    setTimeout(() => setWatchUrlCopied(false), 2000);
  }, []);

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Hidden capture canvas */}
      <video ref={videoRef} className="hidden" playsInline muted />
      <canvas ref={canvasRef} className="hidden" />

      {/* Live video preview with crop selection overlay */}
      {streaming && (
        <div
          className={`relative rounded-xl overflow-hidden border ${
            selecting
              ? "border-amber-400 cursor-crosshair"
              : "border-neutral-200"
          }`}
          style={{ width: 480, height: 360 }}
          onMouseDown={handleMouseDown}
          onMouseUp={handleMouseUp}
        >
          <video
            ref={(el) => {
              if (el && videoRef.current?.srcObject) {
                el.srcObject = videoRef.current.srcObject;
                el.play();
              }
            }}
            className="w-full h-full object-contain bg-neutral-50"
            playsInline
            muted
          />
          {crop && !selecting && (
            <div
              className="absolute border-2 border-emerald-500 bg-emerald-500/10 pointer-events-none"
              style={{
                left: `${(crop.x / (videoRef.current?.videoWidth ?? 640)) * 100}%`,
                top: `${(crop.y / (videoRef.current?.videoHeight ?? 480)) * 100}%`,
                width: `${(crop.w / (videoRef.current?.videoWidth ?? 640)) * 100}%`,
                height: `${(crop.h / (videoRef.current?.videoHeight ?? 480)) * 100}%`,
              }}
            />
          )}
          {selecting && (
            <div className="absolute inset-0 flex items-center justify-center bg-white/30">
              <span className="text-amber-600 text-xs font-medium">
                Drag to select LCD area
              </span>
            </div>
          )}
        </div>
      )}

      {/* Status indicators */}
      {logging && (
        <div className="text-emerald-600 text-xs font-medium">
          Logging active
        </div>
      )}

      {streaming && isLive && (
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-emerald-600 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Live
          </span>
          <RecordingControls roomName={ROOM_NAME} mediaStream={streamRef.current} onStopLive={disconnectLiveKit} />
        </div>
      )}

      {/* Copyable /watch URL when live */}
      {streaming && isLive && (
        <button
          onClick={copyWatchUrl}
          className="text-xs text-neutral-500 hover:text-neutral-700 font-mono transition-colors"
        >
          {watchUrlCopied ? "Copied!" : `${window.location.origin}/watch`}
        </button>
      )}

      {error && <div className="text-red-500 text-xs">{error}</div>}

      {lastOcr !== null && (
        <div className="text-neutral-400 text-xs font-mono">
          OCR: &quot;{lastOcr.trim() || "(empty)"}&quot;
        </div>
      )}

      {/* Main buttons — max 3 visible */}
      <div className="flex gap-2 items-center">
        <button
          onClick={streaming ? stopCapture : startCapture}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            streaming
              ? "bg-red-500 hover:bg-red-600 text-white"
              : "bg-emerald-600 hover:bg-emerald-700 text-white"
          }`}
        >
          {streaming ? "Stop" : "Start Capture"}
        </button>

        {streaming && (
          <button
            onClick={isLive ? disconnectLiveKit : handleGoLive}
            disabled={goingLive}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              isLive
                ? "bg-red-500 hover:bg-red-600 text-white"
                : "bg-violet-600 hover:bg-violet-700 text-white"
            } disabled:opacity-50`}
          >
            {goingLive ? "Connecting..." : isLive ? "End Live" : "Go Live"}
          </button>
        )}

        {streaming && !selecting && (
          <button
            onClick={() => setSelecting(true)}
            className="px-4 py-2 rounded-lg text-sm font-medium bg-neutral-100 hover:bg-neutral-200 text-neutral-700 border border-neutral-200 transition-colors"
          >
            Set Region
          </button>
        )}
      </div>

      {/* Reset crop — small text link */}
      {crop && (
        <button
          onClick={resetCrop}
          className="text-xs text-neutral-400 hover:text-neutral-600 transition-colors"
        >
          Reset crop region
        </button>
      )}
    </div>
  );
}
