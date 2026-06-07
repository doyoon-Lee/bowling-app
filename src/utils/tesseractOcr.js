const TESSERACT_MARK_WHITELIST = "0123456789Xx/\u2215\\|-IlOoSsBb";
const TESSERACT_SCORE_WHITELIST = "0123456789 ";

let workerPromise = null;
let tesseractAvailable = null;

function normalizeText(text = "") {
  return String(text)
    .replace(/[xX]/g, "X")
    .replace(/[\u2215\\]/g, "/")
    .replace(/[|Il]/g, "1")
    .replace(/[oO]/g, "0")
    .replace(/[sS]/g, "5")
    .replace(/[bB]/g, "8")
    .replace(/[^0-9X/\-]/g, "");
}

function splitMark(text, frameNo) {
  const cleaned = normalizeText(text);
  if (!cleaned) return "";

  const tokens = cleaned.split("").slice(0, frameNo === 10 ? 3 : 2);
  if (frameNo < 10) {
    if (tokens[0] === "X") return "X";
    if (tokens.length >= 2 && tokens[1] === "/") return `${tokens[0]}|/`;
    if (tokens.length >= 2) return `${tokens[0]}|${tokens[1]}`;
    return tokens[0];
  }

  return tokens.join("|");
}

async function getTesseractWorker() {
  if (tesseractAvailable === false) return null;

  if (!workerPromise) {
    workerPromise = (async () => {
      try {
        const mod = await import("tesseract.js");
        const createWorker = mod.createWorker || mod.default?.createWorker;
        if (!createWorker) throw new Error("createWorker not found");

        const worker = await createWorker("eng", 1, {
          logger: () => {},
        });

        tesseractAvailable = true;
        return worker;
      } catch (error) {
        console.warn("Tesseract OCR is not available:", error);
        tesseractAvailable = false;
        return null;
      }
    })();
  }

  return workerPromise;
}

async function setWorkerWhitelist(worker, whitelist) {
  if (!worker) return;
  await worker.setParameters({
    tessedit_char_whitelist: whitelist,
    preserve_interword_spaces: "1",
  });
}

async function recognizeFrame(file, frameNo) {
  const worker = await getTesseractWorker();
  if (!worker || !file) return null;

  try {
    await setWorkerWhitelist(worker, TESSERACT_MARK_WHITELIST);
    const result = await worker.recognize(file);
    const text = result?.data?.text || "";
    const confidence = Number(result?.data?.confidence ?? 0);
    const mark = splitMark(text, frameNo);

    return {
      frame: frameNo,
      mark,
      rawText: text,
      confidence,
      source: "tesseract",
    };
  } catch (error) {
    console.warn(`Tesseract OCR failed at frame ${frameNo}:`, error);
    return null;
  }
}

function extractScoreCandidates(text = "") {
  return String(text)
    .match(/\d{1,3}/g)
    ?.map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= 300) || [];
}

function isLikelyCumulativeSequence(values = []) {
  if (values.length < 2) return false;
  for (let index = 1; index < values.length; index += 1) {
    if (values[index] < values[index - 1]) return false;
    const previous = index > 0 ? values[index - 1] : 0;
    if (values[index] - previous > 30) return false;
  }
  return true;
}

function scoreCumulativeSequence(sequence = [], sourceLength = 0) {
  if (!sequence.length) return -Infinity;
  let score = sequence.length * 100;
  if (sequence.length === 10) score += 450;
  if (isLikelyCumulativeSequence(sequence)) score += 160;

  sequence.forEach((value, index) => {
    const previous = index > 0 ? sequence[index - 1] : 0;
    const delta = value - previous;
    if (delta < 0 || delta > 30) score -= 220;
    if (index === 0 && value > 30) score -= 120;
    if (value > 0 && value <= 300) score += 4;
  });

  const last = sequence[sequence.length - 1];
  if (last >= 100 && last <= 300) score += 60;
  if (sourceLength > 0) score -= Math.abs(sourceLength - sequence.join("").length) * 3;
  return score;
}

function findBestSequenceFromJoinedDigits(text = "") {
  const digits = String(text).replace(/\D/g, "");
  if (digits.length < 8) return [];

  let best = { sequence: [], score: -Infinity };

  function walk(offset, sequence) {
    if (sequence.length > 10) return;
    if (offset >= digits.length || sequence.length === 10) {
      const candidateScore = scoreCumulativeSequence(sequence, digits.length);
      if (candidateScore > best.score) best = { sequence, score: candidateScore };
      return;
    }

    for (let length = 1; length <= 3; length += 1) {
      const chunk = digits.slice(offset, offset + length);
      if (!chunk) continue;
      const value = Number(chunk);
      if (!Number.isFinite(value) || value < 0 || value > 300) continue;

      const previous = sequence.length > 0 ? sequence[sequence.length - 1] : 0;
      if (sequence.length === 0 && value > 30) continue;
      if (value < previous) continue;
      if (value - previous > 30) continue;

      walk(offset + length, [...sequence, value]);
    }
  }

  walk(0, []);
  return best.sequence.length >= 6 ? best.sequence.slice(0, 10) : [];
}

function findBestCumulativeSequence(values = [], rawText = "") {
  const joinedDigitSequence = findBestSequenceFromJoinedDigits(rawText);
  const candidates = values.filter((value) => value >= 0 && value <= 300);

  if (joinedDigitSequence.length >= 8 && scoreCumulativeSequence(joinedDigitSequence) >= scoreCumulativeSequence(candidates)) {
    return joinedDigitSequence;
  }

  if (candidates.length <= 10 && isLikelyCumulativeSequence(candidates)) return candidates;

  let best = [];

  function walk(startIndex, sequence) {
    if (scoreCumulativeSequence(sequence) > scoreCumulativeSequence(best)) best = sequence;
    if (best.length >= 10) return;

    for (let index = startIndex; index < candidates.length; index += 1) {
      const value = candidates[index];
      const last = sequence[sequence.length - 1];
      if (last !== undefined && value < last) continue;
      if (last !== undefined && value - last > 30) continue;
      if (sequence.length === 0 && value > 30) continue;
      if (value <= 10 && sequence.length > 0) continue;
      walk(index + 1, [...sequence, value]);
    }
  }

  walk(0, []);
  return best.slice(-10);
}

export async function analyzeCumulativeScoresWithTesseract(rowFile) {
  const worker = await getTesseractWorker();
  if (!worker || !rowFile) return { scores: [], rawText: "", confidence: 0 };

  try {
    await setWorkerWhitelist(worker, TESSERACT_SCORE_WHITELIST);
    const result = await worker.recognize(rowFile);
    const rawText = result?.data?.text || "";
    const confidence = Number(result?.data?.confidence ?? 0);
    const candidates = extractScoreCandidates(rawText);
    const scores = findBestCumulativeSequence(candidates, rawText);

    return { scores, rawText, confidence, source: "tesseract_cumulative" };
  } catch (error) {
    console.warn("Tesseract cumulative score OCR failed:", error);
    return { scores: [], rawText: "", confidence: 0 };
  }
}

export async function analyzeFramesWithTesseract(frameImages = []) {
  if (!Array.isArray(frameImages) || frameImages.length === 0) return [];

  const results = [];
  for (const item of frameImages) {
    const frameNo = Number(item?.frame || results.length + 1);
    const result = await recognizeFrame(item?.file, frameNo);
    if (result?.mark) results.push(result);
  }

  return results;
}

export async function analyzeFinalScoreWithTesseract(finalScoreFile) {
  const worker = await getTesseractWorker();
  if (!worker || !finalScoreFile) return { score: null, rawText: "", confidence: 0 };

  try {
    await setWorkerWhitelist(worker, TESSERACT_SCORE_WHITELIST);
    const result = await worker.recognize(finalScoreFile);
    const rawText = result?.data?.text || "";
    const confidence = Number(result?.data?.confidence ?? 0);
    const candidates = extractScoreCandidates(rawText)
      .filter((value) => value >= 0 && value <= 300)
      .sort((a, b) => String(b).length - String(a).length || b - a);

    return {
      score: candidates.length > 0 ? candidates[0] : null,
      rawText,
      confidence,
      source: "tesseract_final_score",
    };
  } catch (error) {
    console.warn("Tesseract final score OCR failed:", error);
    return { score: null, rawText: "", confidence: 0 };
  }
}
