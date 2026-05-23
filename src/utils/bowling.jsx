import React from "react";

export const keypadNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 10];
export const allPins = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

export function formatRollMark(value) {
  if (value === undefined || value === null) return "";
  if (value === 10) return "X";
  if (value === 0) return "-";
  return String(value);
}

export function formatFrameMark(first, second, third, frame) {
  if (first === undefined) return "";

  if (frame < 10) {
    if (first === 10) return "X";
    if (second === undefined) return `${formatRollMark(first)} |`;
    if (first + second === 10) return `${formatRollMark(first)} | /`;
    return `${formatRollMark(first)} | ${formatRollMark(second)}`;
  }

  const firstMark = formatRollMark(first);
  let secondMark = "";
  let thirdMark = "";

  if (second !== undefined) {
    if (first !== 10 && first + second === 10) secondMark = "/";
    else secondMark = formatRollMark(second);
  }

  if (third !== undefined) {
    if (first === 10 && second !== 10 && second + third === 10) thirdMark = "/";
    else thirdMark = formatRollMark(third);
  }

  return [firstMark, secondMark, thirdMark].filter(Boolean).join(" | ");
}

export function calcBowlingScore(rolls) {
  let score = 0;
  let rollIndex = 0;
  const frames = [];

  for (let frame = 1; frame <= 10; frame++) {
    const first = rolls[rollIndex];
    const second = rolls[rollIndex + 1];

    if (frame < 10) {
      if (first === undefined) {
        frames.push({ frame, mark: "", total: "" });
        continue;
      }

      if (first === 10) {
        const bonus1 = rolls[rollIndex + 1];
        const bonus2 = rolls[rollIndex + 2];
        const canCalculate = bonus1 !== undefined && bonus2 !== undefined;
        if (canCalculate) score += 10 + bonus1 + bonus2;
        frames.push({ frame, mark: "X", total: canCalculate ? score : "" });
        rollIndex += 1;
        continue;
      }

      if (second === undefined) {
        frames.push({ frame, mark: formatFrameMark(first, undefined, undefined, frame), total: "" });
        rollIndex += 2;
        continue;
      }

      if (first + second === 10) {
        const bonus = rolls[rollIndex + 2];
        const canCalculate = bonus !== undefined;
        if (canCalculate) score += 10 + bonus;
        frames.push({ frame, mark: formatFrameMark(first, second, undefined, frame), total: canCalculate ? score : "" });
      } else {
        score += first + second;
        frames.push({ frame, mark: formatFrameMark(first, second, undefined, frame), total: score });
      }

      rollIndex += 2;
      continue;
    }

    const tenthRolls = rolls.slice(rollIndex);
    if (tenthRolls.length === 0) {
      frames.push({ frame, mark: "", total: "" });
      continue;
    }

    const [a, b, c] = tenthRolls;
    const tenthMark = formatFrameMark(a, b, c, frame);
    const tenthComplete = tenthRolls.length === 3 || (tenthRolls.length === 2 && a !== 10 && a + b < 10);

    if (tenthComplete) {
      score += tenthRolls.reduce((sum, roll) => sum + Number(roll ?? 0), 0);
    }

    frames.push({ frame, mark: tenthMark, total: tenthComplete ? score : "" });
  }

  const visibleTotal = [...frames].reverse().find((frame) => frame.total !== "")?.total || 0;
  return { total: visibleTotal, frames };
}

export function calcMaxPossibleScore(rolls) {
  const next = getFrameRollLimit(rolls);
  if (!next) return calcBowlingScore(rolls).total;

  const simulated = [...rolls];
  let guard = 0;

  while (getFrameRollLimit(simulated) && guard < 25) {
    const limit = getFrameRollLimit(simulated);
    simulated.push(limit.max);
    guard += 1;
  }

  return calcBowlingScore(simulated).total;
}

export function getFrameRollLimit(rolls) {
  let rollIndex = 0;

  for (let frame = 1; frame <= 9; frame++) {
    const first = rolls[rollIndex];
    if (first === undefined) return { frame, rollInFrame: 1, max: 10, canStrike: true };

    if (first === 10) {
      rollIndex += 1;
      continue;
    }

    const second = rolls[rollIndex + 1];
    if (second === undefined) return { frame, rollInFrame: 2, max: 10 - first, canStrike: false };

    rollIndex += 2;
  }

  const tenth = rolls.slice(rollIndex);

  if (tenth.length === 0) return { frame: 10, rollInFrame: 1, max: 10, canStrike: true };

  if (tenth.length === 1) {
    return {
      frame: 10,
      rollInFrame: 2,
      max: tenth[0] === 10 ? 10 : 10 - tenth[0],
      canStrike: tenth[0] === 10,
    };
  }

  if (tenth.length === 2) {
    const [a, b] = tenth;

    if (a === 10) {
      if (b === 10) return { frame: 10, rollInFrame: 3, max: 10, canStrike: true };
      return { frame: 10, rollInFrame: 3, max: 10 - b, canStrike: false };
    }

    if (a + b === 10) return { frame: 10, rollInFrame: 3, max: 10, canStrike: true };

    return null;
  }

  return null;
}

export function getCurrentFrameStartIndex(rolls, frame) {
  let idx = 0;

  for (let f = 1; f < frame; f++) {
    if (rolls[idx] === 10 && f < 10) idx += 1;
    else idx += 2;
  }

  return idx;
}

export function formatPinButton(pins, next, rolls) {
  if (!next) return String(pins);

  const currentFrameStart = getCurrentFrameStartIndex(rolls, next.frame);
  const firstRoll = rolls[currentFrameStart];
  const secondRoll = rolls[currentFrameStart + 1];
  const isTenthFrame = next.frame === 10;

  if (pins === 10 && next.canStrike) return "X";

  if (next.rollInFrame === 2) {
    if (isTenthFrame && firstRoll === 10) {
      if (pins === 0) return "-";
      return String(pins);
    }

    if (firstRoll !== undefined) {
      const spareValue = 10 - firstRoll;
      if (pins === spareValue) return "/";
      if (pins === 0) return "-";
    }
  }

  if (isTenthFrame && next.rollInFrame === 3) {
    if (firstRoll === 10 && secondRoll !== 10) {
      const spareValue = 10 - secondRoll;
      if (pins === spareValue) return "/";
    }

    if (pins === 0) return "-";
  }

  if (pins === 0) return "-";
  return String(pins);
}

export function renderFrameMark(mark) {
  if (!mark) return "\u00A0";

  return String(mark)
    .replace(/\s*\|\s*/g, " | ")
    .trim();
}

  const parts = String(mark)
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 1) {
    return React.createElement("span", { className: "markPart single" }, parts[0]);
  }

  return parts.map((part, index) =>
    React.createElement(
      React.Fragment,
      { key: `${part}-${index}` },
      React.createElement("span", { className: "markPart" }, part),
      index < parts.length - 1
        ? React.createElement("span", { className: "markDivider" }, "|")
        : null
    )
  );
}

export function displayTotal(total) {
  return total === "" || total === undefined || total === null ? " " : total;
}

export function isGutterSpareAvailable(next, rolls) {
  if (!next || next.frame >= 10 || next.rollInFrame !== 2) return false;

  const currentFrameStart = getCurrentFrameStartIndex(rolls, next.frame);
  return rolls[currentFrameStart] === 0;
}

export function isTenthFrameGutterSpareAvailable(next, rolls) {
  if (!next || next.frame !== 10 || next.rollInFrame !== 3) return false;

  const tenthStart = getCurrentFrameStartIndex(rolls, 10);
  const firstRoll = rolls[tenthStart];
  const secondRoll = rolls[tenthStart + 1];

  return firstRoll === 10 && secondRoll === 0;
}

export function parseGeminiFrameRolls(frame) {
  const frameNo = Number(frame?.frame);

  const mark = String(frame?.mark || "")
    .toUpperCase()
    .replace(/[×✕＊*]/g, "X")
    .replace(/[／]/g, "/")
    .replace(/[–—_]/g, "-")
    .replace(/\s+/g, "")
    .trim();

  const fallback = Array.isArray(frame?.rolls)
    ? frame.rolls
        .map((roll) => Number(roll))
        .filter((roll) => Number.isInteger(roll) && roll >= 0 && roll <= 10)
    : [];

  if (!frameNo || !mark) return fallback;

  if (frameNo < 10) {
    if (mark.includes("X")) return [10];

    if (mark.includes("/")) {
      const firstToken = mark.match(/[0-9-]/)?.[0];
      const first = firstToken === "-" ? 0 : Number(firstToken);

      if (Number.isInteger(first) && first >= 0 && first <= 9) {
        return [first, 10 - first];
      }
    }

    const digits = mark.match(/[0-9-]/g) || [];

    if (digits.length >= 2) {
      const first = digits[0] === "-" ? 0 : Number(digits[0]);
      const second = digits[1] === "-" ? 0 : Number(digits[1]);

      if (
        Number.isInteger(first) &&
        Number.isInteger(second) &&
        first >= 0 &&
        second >= 0 &&
        first + second <= 10
      ) {
        return [first, second];
      }
    }

    return fallback;
  }

  const tokens = mark.match(/X|\/|[0-9-]/g) || [];
  const rolls = [];

  tokens.forEach((token) => {
    if (token === "X") {
      rolls.push(10);
      return;
    }

    if (token === "-") {
      rolls.push(0);
      return;
    }

    if (token === "/") {
      const prev = rolls[rolls.length - 1];
      if (Number.isInteger(prev)) rolls.push(10 - prev);
      return;
    }

    const value = Number(token);
    if (Number.isInteger(value) && value >= 0 && value <= 10) {
      rolls.push(value);
    }
  });

  return rolls.length > 0 ? rolls.slice(0, 3) : fallback.slice(0, 3);
}

export function normalizeGeminiRollsFromFrames(frames, fallbackRolls = []) {
  if (!Array.isArray(frames) || frames.length === 0) return fallbackRolls;

  const rebuilt = [];

  frames
    .slice()
    .sort((a, b) => Number(a.frame || 0) - Number(b.frame || 0))
    .forEach((frame) => {
      const frameRolls = parseGeminiFrameRolls(frame);
      frameRolls.forEach((roll) => rebuilt.push(roll));
    });

  return rebuilt.length > 0 ? rebuilt.slice(0, 21) : fallbackRolls;
}

export function isCompleteGameRolls(rolls) {
  return getFrameRollLimit(rolls) === null;
}

export function findCompletedRollsByFinalScore(rolls, finalScore) {
  const targetScore = Number(finalScore);
  if (!Number.isFinite(targetScore) || targetScore <= 0) return rolls;
  if (isCompleteGameRolls(rolls)) return rolls;

  const queue = [rolls];
  const visited = new Set([rolls.join(",")]);

  while (queue.length > 0) {
    const current = queue.shift();
    const nextLimit = getFrameRollLimit(current);

    if (!nextLimit) {
      const score = calcBowlingScore(current).total;
      if (score === targetScore) return current;
      continue;
    }

    if (nextLimit.frame !== 10) continue;

    for (let pins = 0; pins <= nextLimit.max; pins++) {
      const candidate = [...current, pins];
      const key = candidate.join(",");
      if (visited.has(key)) continue;

      visited.add(key);
      queue.push(candidate);
    }
  }

  return rolls;
}

export function repairTenthFrameRolls(rolls, frames = [], finalScore = 0, cumulativeScores = []) {
  let repaired = [...rolls];
  const tenthStart = getCurrentFrameStartIndex(repaired, 10);
  const tenthRolls = repaired.slice(tenthStart);
  const tenthFrame = Array.isArray(frames)
    ? frames.find((frame) => Number(frame.frame) === 10)
    : null;
  const tenthMark = String(tenthFrame?.mark || "").toUpperCase();
  const normalizedFinalScore = Number(finalScore || cumulativeScores?.[cumulativeScores.length - 1] || 0);

  if (tenthRolls.length === 1 && tenthRolls[0] === 10) {
    const xCount = (tenthMark.match(/X/g) || []).length;

    if (xCount >= 3) {
      repaired.push(10, 10);
    }
  }

  if (tenthRolls.length === 2 && tenthRolls[0] === 10) {
    const xCount = (tenthMark.match(/X/g) || []).length;

    if (xCount >= 3) {
      repaired.push(10);
    }
  }

  repaired = findCompletedRollsByFinalScore(repaired, normalizedFinalScore);

  return repaired.slice(0, 21);
}

export function getPreview(frame) {
  const parsedRolls = parseGeminiFrameRolls(frame);

  if (parsedRolls.length > 0) {
    const [first, second, third] = parsedRolls;
    return formatFrameMark(first, second, third, Number(frame.frame));
  }

  const rawMark = String(frame?.mark || "").trim();

  if (Number(frame?.frame) < 10 && /^[0-9][0-9]$/.test(rawMark)) {
    return rawMark[0] + " | " + rawMark[1];
  }

  return rawMark;
}
