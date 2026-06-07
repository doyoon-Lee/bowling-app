export const allPins = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function pinName(pins) {
  const sorted = [...pins].sort((a, b) => a - b);
  if (sorted.length === 0) return "스트라이크";
  if (sorted.length === 1) return `${sorted[0]}핀`;
  return sorted.join("-");
}

export function isSplitLeave(pins) {
  const key = [...pins].sort((a, b) => a - b).join("-");
  const splitKeys = new Set([
    "7-10",
    "4-6",
    "4-10",
    "6-7",
    "2-7",
    "3-10",
    "2-4-10",
    "3-6-7",
    "4-6-7-10",
    "2-8-10",
    "3-7-9",
  ]);

  return splitKeys.has(key);
}

export function calcProStats(pinFrames) {
  const attempts = pinFrames.filter((item) => item.firstRemaining?.length > 0);
  const converted = attempts.filter((item) => item.converted);
  const tenPin = attempts.filter((item) => item.firstRemaining.length === 1 && item.firstRemaining[0] === 10);
  const sevenPin = attempts.filter((item) => item.firstRemaining.length === 1 && item.firstRemaining[0] === 7);
  const splits = attempts.filter((item) => item.isSplit);

  const rate = (items, successItems) => {
    if (!items.length) return 0;
    return Math.round((successItems.length / items.length) * 100);
  };

  return {
    totalAttempts: attempts.length,
    totalConverted: converted.length,
    totalRate: rate(attempts, converted),
    tenPinAttempts: tenPin.length,
    tenPinConverted: tenPin.filter((item) => item.converted).length,
    tenPinRate: rate(tenPin, tenPin.filter((item) => item.converted)),
    sevenPinAttempts: sevenPin.length,
    sevenPinConverted: sevenPin.filter((item) => item.converted).length,
    sevenPinRate: rate(sevenPin, sevenPin.filter((item) => item.converted)),
    splitAttempts: splits.length,
    splitConverted: splits.filter((item) => item.converted).length,
    splitRate: rate(splits, splits.filter((item) => item.converted)),
  };
}
