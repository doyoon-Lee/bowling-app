
export function normalizeGeminiResult(result) {
  return result.map((frame, index) => {
    const isTenth = index === 9;

    if (!isTenth) {
      return frame.filter(v => v !== "");
    }

    // XXX 붙은 경우 분리
    if (frame.join("") === "XXX") {
      return ["X", "X", "X"];
    }

    return frame;
  });
}
