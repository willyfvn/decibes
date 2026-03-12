import { ConvexHttpClient } from "convex/browser";
import { api } from "../convex/_generated/api";
import { readDecibels } from "./ocr";
import { execFileSync } from "node:child_process";
import { readFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const CONVEX_URL = process.env.VITE_CONVEX_URL ?? process.env.CONVEX_URL;
if (!CONVEX_URL) {
  console.error("Set CONVEX_URL or VITE_CONVEX_URL env var");
  process.exit(1);
}

const client = new ConvexHttpClient(CONVEX_URL);
const CAPTURE_DIR = join(import.meta.dirname, "frames");
const FRAME_PATH = join(CAPTURE_DIR, "frame.jpg");
const INTERVAL_MS = 2000;

// Webcam device — override with WEBCAM_DEVICE env var (e.g. /dev/video0 or "0" on macOS)
const WEBCAM_DEVICE = process.env.WEBCAM_DEVICE ?? "0";

mkdirSync(CAPTURE_DIR, { recursive: true });

function captureFrame(): boolean {
  try {
    execFileSync("ffmpeg", [
      "-y",
      "-f", "avfoundation",
      "-framerate", "1",
      "-video_size", "640x480",
      "-i", WEBCAM_DEVICE,
      "-frames:v", "1",
      FRAME_PATH,
    ], { timeout: 10000, stdio: "pipe" });
    return true;
  } catch (err) {
    console.warn("ffmpeg capture failed:", (err as Error).message);
    return false;
  }
}

async function tick() {
  const now = Date.now();

  if (!captureFrame()) return;

  const imageBuffer = readFileSync(FRAME_PATH);
  const base64 = imageBuffer.toString("base64");

  // Push snapshot
  await client.mutation(api.snapshots.updateSnapshot, {
    image: base64,
    timestamp: now,
  });

  // Try OCR
  const reading = readDecibels(FRAME_PATH);
  if (reading) {
    await client.mutation(api.readings.addReading, {
      value: reading.value,
      raw_text: reading.raw_text,
      timestamp: now,
    });
    console.log(`[${new Date(now).toLocaleTimeString()}] ${reading.value} dB (raw: "${reading.raw_text}")`);
  } else {
    console.log(`[${new Date(now).toLocaleTimeString()}] snapshot pushed, OCR failed`);
  }
}

console.log("Decibes capture starting...");
console.log(`  Convex: ${CONVEX_URL}`);
console.log(`  Webcam: ${WEBCAM_DEVICE}`);
console.log(`  Interval: ${INTERVAL_MS}ms`);

// Run immediately, then on interval
tick();
setInterval(tick, INTERVAL_MS);
