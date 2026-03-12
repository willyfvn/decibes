import { execFileSync } from "node:child_process";

/**
 * Runs ssocr on a JPEG image to extract a dB reading from a seven-segment LCD.
 * Returns { value, raw_text } or null if OCR fails.
 */
export function readDecibels(
  imagePath: string
): { value: number; raw_text: string } | null {
  try {
    const raw = execFileSync("ssocr", [
      "--number-digits", "-1",
      "--number-pixels", "0",
      "--one-ratio", "3",
      "--minus-ratio", "2",
      "--threshold", "50",
      "crop", "0", "0", "0", "0",
      imagePath,
    ], {
      encoding: "utf-8",
      timeout: 5000,
    }).trim();

    const cleaned = raw.replace(/[^0-9.\-]/g, "");
    const value = parseFloat(cleaned);

    if (isNaN(value)) {
      console.warn(`ssocr returned unparseable text: "${raw}"`);
      return null;
    }

    return { value, raw_text: raw };
  } catch (err) {
    console.warn("ssocr failed:", (err as Error).message);
    return null;
  }
}
