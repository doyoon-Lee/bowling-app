const clamp = (value, min = 0, max = 255) => Math.max(min, Math.min(max, value));

function createCanvas(width, height) {
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

function sharpenImageData(imageData, amount = 0.45) {
  const { width, height, data } = imageData;
  const source = new Uint8ClampedArray(data);
  const center = 1 + 4 * amount;
  const side = -amount;

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const offset = (y * width + x) * 4;
      const left = offset - 4;
      const right = offset + 4;
      const up = offset - width * 4;
      const down = offset + width * 4;

      for (let channel = 0; channel < 3; channel += 1) {
        data[offset + channel] = clamp(
          source[offset + channel] * center +
            source[left + channel] * side +
            source[right + channel] * side +
            source[up + channel] * side +
            source[down + channel] * side
        );
      }
    }
  }

  return imageData;
}

function normalizeImageData(imageData, { contrast = 1.45, brightness = 10, threshold = false } = {}) {
  const { data } = imageData;

  for (let index = 0; index < data.length; index += 4) {
    const gray = data[index] * 0.299 + data[index + 1] * 0.587 + data[index + 2] * 0.114;
    let value = clamp((gray - 128) * contrast + 128 + brightness);

    if (threshold) {
      value = value >= 155 ? 255 : 0;
    }

    data[index] = value;
    data[index + 1] = value;
    data[index + 2] = value;
  }

  return imageData;
}

export function preprocessScoreCanvas(sourceCanvas, options = {}) {
  if (!sourceCanvas) return null;

  const {
    minWidth = 1200,
    maxWidth = 2200,
    paddingRatio = 0.035,
    threshold = false,
  } = options;

  const scale = Math.max(1, Math.min(maxWidth / sourceCanvas.width, minWidth / sourceCanvas.width));
  const scaledWidth = Math.round(sourceCanvas.width * scale);
  const scaledHeight = Math.round(sourceCanvas.height * scale);
  const paddingX = Math.round(scaledWidth * paddingRatio);
  const paddingY = Math.round(scaledHeight * paddingRatio);

  const canvas = createCanvas(scaledWidth + paddingX * 2, scaledHeight + paddingY * 2);
  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(sourceCanvas, paddingX, paddingY, scaledWidth, scaledHeight);

  let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  imageData = normalizeImageData(imageData, { threshold });
  imageData = sharpenImageData(imageData, 0.38);
  ctx.putImageData(imageData, 0, 0);

  return canvas;
}

export async function canvasToImageFile(canvas, filename, type = "image/jpeg", quality = 0.95) {
  if (!canvas) return null;

  const blob = await new Promise((resolve) => {
    canvas.toBlob((nextBlob) => resolve(nextBlob), type, quality);
  });

  if (!blob) return null;
  return new File([blob], filename, { type });
}
