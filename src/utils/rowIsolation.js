function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function getRowActivity(canvas) {
  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const data = ctx.getImageData(0, 0, width, height).data;
  const rows = new Array(height).fill(0);

  for (let y = 0; y < height; y += 1) {
    let activity = 0;
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      const prevOffset = (y * width + x - 1) * 4;
      const r = data[offset];
      const g = data[offset + 1];
      const b = data[offset + 2];
      const gray = r * 0.299 + g * 0.587 + b * 0.114;
      const prevGray = data[prevOffset] * 0.299 + data[prevOffset + 1] * 0.587 + data[prevOffset + 2] * 0.114;

      const edge = Math.abs(gray - prevGray);
      const brightText = gray > 120 ? 255 - Math.abs(210 - gray) : 0;
      const blueUi = b > 80 && b > r * 1.15 ? 65 : 0;
      activity += edge * 0.8 + brightText * 0.08 + blueUi;
    }
    rows[y] = activity / Math.max(1, width);
  }

  return smoothRows(rows, Math.max(2, Math.round(height * 0.025)));
}

function smoothRows(rows, radius) {
  return rows.map((_, index) => {
    const start = Math.max(0, index - radius);
    const end = Math.min(rows.length - 1, index + radius);
    let sum = 0;
    for (let cursor = start; cursor <= end; cursor += 1) sum += rows[cursor];
    return sum / (end - start + 1);
  });
}

function percentile(values, ratio) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = clamp(Math.round((sorted.length - 1) * ratio), 0, sorted.length - 1);
  return sorted[index];
}

function findActiveBands(rows) {
  const threshold = Math.max(percentile(rows, 0.62), percentile(rows, 0.85) * 0.48);
  const bands = [];
  let start = null;
  let score = 0;

  rows.forEach((value, index) => {
    if (value >= threshold) {
      if (start === null) {
        start = index;
        score = 0;
      }
      score += value;
      return;
    }

    if (start !== null) {
      bands.push({ start, end: index - 1, score });
      start = null;
      score = 0;
    }
  });

  if (start !== null) bands.push({ start, end: rows.length - 1, score });
  return mergeCloseBands(bands, rows.length);
}

function mergeCloseBands(bands, height) {
  const minGap = Math.max(2, Math.round(height * 0.055));
  const merged = [];

  for (const band of bands) {
    const last = merged[merged.length - 1];
    if (last && band.start - last.end <= minGap) {
      last.end = band.end;
      last.score += band.score;
    } else {
      merged.push({ ...band });
    }
  }

  return merged.filter((band) => band.end - band.start >= Math.max(3, Math.round(height * 0.025)));
}

function cropCanvas(sourceCanvas, y, height) {
  const canvas = createCanvas(sourceCanvas.width, height);
  const ctx = canvas.getContext("2d");
  ctx.drawImage(sourceCanvas, 0, y, sourceCanvas.width, height, 0, 0, sourceCanvas.width, height);
  return canvas;
}

function pickLikelyScoreRowBand(bands, sourceHeight) {
  if (bands.length === 0) return null;

  const expanded = bands.map((band) => ({
    ...band,
    center: (band.start + band.end) / 2,
    height: band.end - band.start + 1,
  }));

  // If the selected area contains another player's row above the target row,
  // the user's intended row is usually the lower active band. Favor lower bands,
  // but keep enough height to include marks and cumulative scores together.
  expanded.sort((a, b) => {
    const aRank = a.score * (1 + a.center / Math.max(1, sourceHeight) * 0.85) * (1 + Math.min(0.5, a.height / Math.max(1, sourceHeight)));
    const bRank = b.score * (1 + b.center / Math.max(1, sourceHeight) * 0.85) * (1 + Math.min(0.5, b.height / Math.max(1, sourceHeight)));
    return bRank - aRank;
  });

  return expanded[0];
}

export function isolateScoreRowCanvas(sourceCanvas, { force = false } = {}) {
  if (!sourceCanvas?.width || !sourceCanvas?.height) {
    return { canvas: sourceCanvas, method: "none" };
  }

  const { width, height } = sourceCanvas;
  const tallSelection = height / Math.max(1, width) >= 0.145;
  if (!force && !tallSelection) {
    return { canvas: sourceCanvas, method: "not_needed" };
  }

  const rows = getRowActivity(sourceCanvas);
  const bands = findActiveBands(rows);
  const bestBand = pickLikelyScoreRowBand(bands, height);

  if (!bestBand) {
    const topTrim = tallSelection ? Math.round(height * 0.24) : 0;
    const fallbackHeight = height - topTrim;
    return {
      canvas: cropCanvas(sourceCanvas, topTrim, fallbackHeight),
      method: "top_trim_fallback",
    };
  }

  const padding = Math.max(4, Math.round(height * 0.08));
  let y = clamp(bestBand.start - padding, 0, height - 1);
  let bottom = clamp(bestBand.end + padding, y + 1, height);

  // If the active band is only the cumulative-score line, include the marks right above it.
  const minRowHeight = Math.round(height * 0.5);
  if (bottom - y < minRowHeight) {
    const extraTop = Math.round(minRowHeight * 0.58);
    const extraBottom = Math.round(minRowHeight * 0.18);
    y = clamp(y - extraTop, 0, height - 1);
    bottom = clamp(bottom + extraBottom, y + 1, height);
  }

  const croppedHeight = Math.max(1, bottom - y);
  if (croppedHeight >= height * 0.92) {
    return { canvas: sourceCanvas, method: "full_row" };
  }

  return {
    canvas: cropCanvas(sourceCanvas, y, croppedHeight),
    method: "row_isolation",
    y,
    height: croppedHeight,
  };
}
