const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const DEFAULT_FRAME_WEIGHTS = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1.35];

function getColumnScores(canvas) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height).data;
  const scores = new Array(width).fill(0);

  for (let x = 0; x < width; x += 1) {
    let darkScore = 0;
    let edgeScore = 0;

    for (let y = 0; y < height; y += 1) {
      const offset = (y * width + x) * 4;
      const gray = imageData[offset] * 0.299 + imageData[offset + 1] * 0.587 + imageData[offset + 2] * 0.114;
      darkScore += 255 - gray;

      if (x > 0) {
        const prevOffset = (y * width + x - 1) * 4;
        const prevGray = imageData[prevOffset] * 0.299 + imageData[prevOffset + 1] * 0.587 + imageData[prevOffset + 2] * 0.114;
        edgeScore += Math.abs(gray - prevGray);
      }
    }

    scores[x] = darkScore / height + edgeScore / height;
  }

  return smoothScores(scores, Math.max(3, Math.round(width * 0.004)));
}

function smoothScores(scores, radius) {
  return scores.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(scores.length - 1, index + radius);
    let sum = 0;
    for (let cursor = start; cursor <= end; cursor += 1) sum += scores[cursor];
    return sum / (end - start + 1);
  });
}

function weightedFallbackBoundaries(width) {
  const sum = DEFAULT_FRAME_WEIGHTS.reduce((acc, weight) => acc + weight, 0);
  const boundaries = [0];
  let offset = 0;

  for (let index = 0; index < DEFAULT_FRAME_WEIGHTS.length; index += 1) {
    offset += (width * DEFAULT_FRAME_WEIGHTS[index]) / sum;
    boundaries.push(Math.round(index === DEFAULT_FRAME_WEIGHTS.length - 1 ? width : offset));
  }

  return boundaries;
}

function median(values) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function standardDeviation(values, avg) {
  if (!values.length) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function findStrongVerticalLineCandidates(scores, width) {
  const avg = scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
  const threshold = Math.max(median(scores) * 1.35, avg + standardDeviation(scores, avg) * 0.55);
  const minDistance = Math.max(8, Math.round(width * 0.018));
  const candidates = [];

  for (let x = 2; x < width - 2; x += 1) {
    const value = scores[x];
    if (value < threshold) continue;
    if (value < scores[x - 1] || value < scores[x + 1]) continue;

    const last = candidates[candidates.length - 1];
    if (last && x - last.x < minDistance) {
      if (value > last.score) {
        last.x = x;
        last.score = value;
      }
    } else {
      candidates.push({ x, score: value });
    }
  }

  return candidates;
}

function snapFallbackBoundaries(scores, width) {
  const fallback = weightedFallbackBoundaries(width);
  const avg = scores.reduce((sum, score) => sum + score, 0) / Math.max(1, scores.length);
  const minGap = Math.max(12, Math.round(width * 0.045));
  const snapped = [0];

  for (let index = 1; index < fallback.length - 1; index += 1) {
    const expected = fallback[index];
    const searchRadius = Math.max(14, Math.round(width * 0.045));
    const start = Math.max(snapped[index - 1] + minGap, expected - searchRadius);
    const end = Math.min(width - minGap, expected + searchRadius);
    let bestX = expected;
    let bestScore = -Infinity;

    for (let x = start; x <= end; x += 1) {
      if (scores[x] > bestScore) {
        bestScore = scores[x];
        bestX = x;
      }
    }

    const isMeaningfulLine = bestScore > avg * 1.12;
    snapped.push(isMeaningfulLine ? bestX : expected);
  }

  snapped.push(width);
  return snapped;
}

function buildBoxesFromBoundaries(boundaries, height, method) {
  const boxes = [];

  for (let index = 0; index < 10; index += 1) {
    const x = Math.round(boundaries[index]);
    const nextX = Math.round(boundaries[index + 1]);
    boxes.push({
      frame: index + 1,
      x,
      y: 0,
      width: Math.max(1, nextX - x),
      height,
      method,
    });
  }

  return boxes;
}

function normalizeBoundaryCandidates(candidates, width) {
  const edgeMargin = Math.max(8, Math.round(width * 0.02));
  const lines = [0];

  candidates
    .filter((candidate) => candidate.x > edgeMargin && candidate.x < width - edgeMargin)
    .sort((a, b) => a.x - b.x)
    .forEach((candidate) => {
      const last = lines[lines.length - 1];
      if (candidate.x - last > Math.max(10, Math.round(width * 0.025))) {
        lines.push(candidate.x);
      }
    });

  lines.push(width);
  return lines;
}

function chooseGridBoundariesFromCandidates(candidates, width) {
  const lines = normalizeBoundaryCandidates(candidates, width);
  const minCellWidth = width * 0.045;
  const usableLines = lines.filter((line, index) => {
    if (index === 0 || index === lines.length - 1) return true;
    const prev = lines[index - 1];
    const next = lines[index + 1];
    return line - prev >= minCellWidth || next - line >= minCellWidth;
  });

  if (usableLines.length >= 11) {
    const firstEleven = usableLines.slice(0, 11);
    const widths = firstEleven.slice(1).map((line, index) => line - firstEleven[index]);
    const positiveWidths = widths.filter((value) => value > minCellWidth);

    if (positiveWidths.length >= 9) {
      return firstEleven;
    }
  }

  return null;
}

export function detectScoreFrameBoxes(canvas) {
  if (!canvas?.width || !canvas?.height) return [];

  const width = canvas.width;
  const height = canvas.height;
  const scores = getColumnScores(canvas);
  const candidates = findStrongVerticalLineCandidates(scores, width);
  const candidateBoundaries = chooseGridBoundariesFromCandidates(candidates, width);

  if (candidateBoundaries?.length === 11) {
    return buildBoxesFromBoundaries(candidateBoundaries, height, "detected_grid");
  }

  const snapped = snapFallbackBoundaries(scores, width);
  return buildBoxesFromBoundaries(snapped, height, "snapped_fallback");
}

export function cropCanvasByBox(sourceCanvas, box, { paddingXRatio = 0.06, paddingYRatio = 0.08 } = {}) {
  const paddingX = Math.round(box.width * paddingXRatio);
  const paddingY = Math.round(box.height * paddingYRatio);
  const canvas = document.createElement("canvas");
  canvas.width = box.width + paddingX * 2;
  canvas.height = box.height + paddingY * 2;

  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(
    sourceCanvas,
    clamp(box.x, 0, sourceCanvas.width - 1),
    clamp(box.y, 0, sourceCanvas.height - 1),
    clamp(box.width, 1, sourceCanvas.width - box.x),
    clamp(box.height, 1, sourceCanvas.height - box.y),
    paddingX,
    paddingY,
    box.width,
    box.height
  );

  return canvas;
}
