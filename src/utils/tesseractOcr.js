const TESSERACT_WHITELIST = "0123456789Xx/\u2215\\|-IlOoSsBb";

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

        await worker.setParameters({
          tessedit_char_whitelist: TESSERACT_WHITELIST,
          preserve_interword_spaces: "0",
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

async function recognizeFrame(file, frameNo) {
  const worker = await getTesseractWorker();
  if (!worker || !file) return null;

  try {
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
