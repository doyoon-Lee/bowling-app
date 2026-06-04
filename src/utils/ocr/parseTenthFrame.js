
export function parseTenthFrame(rawText) {
  const cleaned = rawText
    .replace(/\s/g, "")
    .replace(/[^X\/\-|0-9]/g, "");

  // XXX 처리
  if (cleaned === "XXX") {
    return ["X", "X", "X"];
  }

  // X9/ 형태
  if (/^X[0-9]\/$/.test(cleaned)) {
    return [cleaned[0], cleaned[1], "/"];
  }

  // 숫자 기반 fallback
  return cleaned.split("").slice(0, 3);
}
