import { calcBowlingScore, parseGeminiFrameRolls, renderFrameMark } from "./bowling";

function cleanMark(mark = "") {
  return String(mark)
    .replace(/\u00A0/g, "")
    .replace(/\s+/g, "")
    .replace(/-/g, "0")
    .replace(/[xX]/g, "X")
    .replace(/[\\\u2215]/g, "/");
}

function markFromRolls(frameNo, rolls = []) {
  const score = calcBowlingScore([].concat(...Array.from({ length: frameNo - 1 }, () => [0, 0]), rolls));
  return renderFrameMark(score.frames[frameNo - 1]?.mark || "").replace(/\u00A0/g, "").trim();
}

function isNumberToken(value) {
  return /^[0-9]$/.test(String(value));
}

function getTokens(mark) {
  return cleanMark(mark).split("|").flatMap((part) => part.split("")).filter(Boolean);
}

function isValidNormalFrameRolls(rolls = []) {
  if (rolls.length === 1) return rolls[0] === 10;
  if (rolls.length !== 2) return false;
  return rolls.every((roll) => Number.isInteger(roll) && roll >= 0 && roll <= 10) && rolls[0] < 10 && rolls[0] + rolls[1] <= 10;
}

function hasSpecialMark(mark) {
  return /[X/]/.test(cleanMark(mark));
}

function shouldTrustTesseract(frameNo, geminiFrame, tesseractFrame) {
  if (!tesseractFrame?.mark) return false;
  if (Number(tesseractFrame.confidence || 0) < 45) return false;

  const tessRolls = parseGeminiFrameRolls({ frame: frameNo, mark: tesseractFrame.mark });
  if (frameNo < 10 && !isValidNormalFrameRolls(tessRolls)) return false;

  const geminiMark = cleanMark(geminiFrame?.mark || "");
  const tessMark = cleanMark(tesseractFrame.mark);

  if (!geminiMark) return true;
  if (hasSpecialMark(geminiMark)) return false;

  const geminiTokens = getTokens(geminiMark);
  const tessTokens = getTokens(tessMark);
  const tessLooksNumeric = tessTokens.length > 0 && tessTokens.every(isNumberToken);
  const geminiLooksNumeric = geminiTokens.length > 0 && geminiTokens.every(isNumberToken);

  return tessLooksNumeric && geminiLooksNumeric && Number(tesseractFrame.confidence || 0) >= 60;
}

function mergeFrame(frameNo, geminiFrame, tesseractFrame) {
  if (!geminiFrame && !tesseractFrame) return null;
  if (!geminiFrame) return tesseractFrame;

  if (shouldTrustTesseract(frameNo, geminiFrame, tesseractFrame)) {
    return {
      ...geminiFrame,
      mark: tesseractFrame.mark,
      ocrSources: { gemini: geminiFrame, tesseract: tesseractFrame, selected: "tesseract" },
    };
  }

  return {
    ...geminiFrame,
    ocrSources: { gemini: geminiFrame, tesseract: tesseractFrame || null, selected: "gemini" },
  };
}

export function mergeGeminiAndTesseractFrames(geminiFrames = [], tesseractFrames = []) {
  const geminiByFrame = new Map(
    (Array.isArray(geminiFrames) ? geminiFrames : [])
      .filter((frame) => Number(frame?.frame))
      .map((frame) => [Number(frame.frame), frame])
  );
  const tessByFrame = new Map(
    (Array.isArray(tesseractFrames) ? tesseractFrames : [])
      .filter((frame) => Number(frame?.frame))
      .map((frame) => [Number(frame.frame), frame])
  );

  const merged = [];
  for (let frameNo = 1; frameNo <= 10; frameNo += 1) {
    const next = mergeFrame(frameNo, geminiByFrame.get(frameNo), tessByFrame.get(frameNo));
    if (next) merged.push({ ...next, frame: frameNo });
  }

  return merged;
}

export function getOcrMergeSummary(frames = []) {
  const selectedTesseract = frames.filter((frame) => frame?.ocrSources?.selected === "tesseract").length;
  const compared = frames.filter((frame) => frame?.ocrSources?.tesseract).length;

  if (!compared) return "Gemini 분석 결과를 기준으로 보정했습니다.";
  if (!selectedTesseract) return `Gemini 결과를 기준으로 사용했고, Tesseract 숫자 OCR ${compared}개 프레임을 비교했습니다.`;
  return `Gemini와 Tesseract를 비교해 숫자 ${selectedTesseract}개 프레임을 보정했습니다.`;
}
