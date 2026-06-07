
import { cropFrameRegions } from "./frameCropper";
import { parseTenthFrame } from "./parseTenthFrame";
import { validateFrames } from "./validateFrames";
import { normalizeGeminiResult } from "./geminiPostProcess";

export async function analyzeBowlingScore(canvas, frameBoxes) {
  const crops = cropFrameRegions(canvas, frameBoxes);

  const results = [];

  for (const crop of crops) {
    const rawText = "XXX"; // OCR 결과 예시

    if (crop.isTenthFrame) {
      results.push(parseTenthFrame(rawText));
    } else {
      results.push(rawText.split(""));
    }
  }

  return validateFrames(
    normalizeGeminiResult(results)
  );
}
