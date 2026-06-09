import { calcBowlingScore, renderFrameMark } from "./bowling";

const CONFIDENCE_REVIEW_THRESHOLD = 0.9;

function normalizeConfidence(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return null;
  if (number > 1) return Math.max(0, Math.min(1, number / 100));
  return Math.max(0, Math.min(1, number));
}

function cleanMark(mark = "") {
  return String(mark)
    .replace(/\u00A0/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "0")
    .replace(/[xX]/g, "X")
    .replace(/[\\\u2215]/g, "/");
}

function getFrameConfidence(frame = {}) {
  const geminiConfidence = normalizeConfidence(frame.confidence);
  const tessConfidence = normalizeConfidence(frame.ocrSources?.tesseract?.confidence);
  const selected = frame.ocrSources?.selected;

  if (selected === "tesseract" && tessConfidence !== null) return tessConfidence;
  if (geminiConfidence !== null && tessConfidence !== null) return Math.min(geminiConfidence, tessConfidence + 0.08);
  if (geminiConfidence !== null) return geminiConfidence;
  if (tessConfidence !== null) return tessConfidence;
  return 0.72;
}

function getFrameReasons(frame, previewFrame, expectedTotal) {
  const reasons = [];
  const geminiMark = cleanMark(frame?.ocrSources?.gemini?.mark || frame?.mark || "");
  const tessMark = cleanMark(frame?.ocrSources?.tesseract?.mark || "");
  const currentMark = cleanMark(previewFrame?.mark || frame?.mark || "");
  const confidence = getFrameConfidence(frame);

  if (confidence < CONFIDENCE_REVIEW_THRESHOLD) reasons.push("신뢰도 확인 필요");
  if (tessMark && geminiMark && tessMark !== geminiMark) reasons.push("Gemini/Tesseract 결과 다름");
  if (!currentMark) reasons.push("투구값 인식 불확실");

  const actualTotal = Number(previewFrame?.total);
  if (Number.isFinite(expectedTotal) && Number.isFinite(actualTotal) && Math.abs(expectedTotal - actualTotal) > 0) {
    reasons.push("누적점수와 검산 불일치");
  }

  if (previewFrame?.frame === 10 && currentMark && !Number.isFinite(actualTotal)) {
    reasons.push("10프레임 보너스 투구 확인 필요");
  }

  return reasons;
}

export function buildOcrReviewFrames({ frames = [], rolls = [], framePreviews = [], cumulativeScores = [], finalScore = null } = {}) {
  const score = calcBowlingScore(Array.isArray(rolls) ? rolls : []);
  const frameMap = new Map((Array.isArray(frames) ? frames : []).map((frame) => [Number(frame.frame), frame]));
  const previewUrlMap = new Map((Array.isArray(framePreviews) ? framePreviews : []).map((item) => [Number(item.frame), item.url]));

  const reviewFrames = [];

  for (let frameNo = 1; frameNo <= 10; frameNo += 1) {
    const frame = frameMap.get(frameNo) || { frame: frameNo };
    const previewFrame = score.frames[frameNo - 1] || { frame: frameNo, mark: "", total: "" };
    const expectedTotal = Number(cumulativeScores[frameNo - 1]);
    const confidence = getFrameConfidence(frame);
    const reasons = getFrameReasons(frame, previewFrame, expectedTotal);

    reviewFrames.push({
      frame: frameNo,
      mark: renderFrameMark(previewFrame.mark || frame.mark || "").replace(/\u00A0/g, "").trim(),
      confidence,
      confidencePercent: Math.round(confidence * 100),
      needsReview: reasons.length > 0,
      reasons,
      imageUrl: previewUrlMap.get(frameNo) || "",
      cumulativeScore: Number.isFinite(expectedTotal) ? expectedTotal : null,
      calculatedScore: Number.isFinite(Number(previewFrame.total)) ? Number(previewFrame.total) : null,
      selectedSource: frame.ocrSources?.selected || "gemini",
    });
  }

  const calculatedFinalScore = Number(score.frames[9]?.total ?? score.total);
  const finalScoreNumber = Number(finalScore);
  const finalScoreMismatch = Number.isFinite(finalScoreNumber) && Number.isFinite(calculatedFinalScore) && finalScoreNumber !== calculatedFinalScore;

  if (finalScoreMismatch) {
    const tenth = reviewFrames[9];
    tenth.needsReview = true;
    tenth.reasons = Array.from(new Set([...(tenth.reasons || []), "최종점수와 계산값 불일치"]));
  }

  return reviewFrames;
}

export function getOcrReviewSummary(reviewFrames = []) {
  const targets = reviewFrames.filter((frame) => frame.needsReview);
  if (targets.length === 0) return "확인 필요한 프레임 없이 안정적으로 인식됐습니다.";
  return `${targets.length}개 프레임 확인이 필요합니다.`;
}
