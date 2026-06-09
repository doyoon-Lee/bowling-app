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

function normalizeOcrMarkText(value) {
  return String(value || "")
    .toUpperCase()
    .replace(/[×✕＊*]/g, "X")
    .replace(/[／\\]/g, "/")
    .replace(/[–—_]/g, "-")
    .replace(/[OoQ]/g, "0")
    .replace(/[IiLl!]/g, "1")
    .replace(/[Ss]/g, "5")
    .replace(/[Bb]/g, "8")
    .replace(/\s+/g, "")
    .trim();
}

function getCleanFallbackRolls(frame) {
  return Array.isArray(frame?.rolls)
    ? frame.rolls
        .map((roll) => Number(roll))
        .filter((roll) => Number.isInteger(roll) && roll >= 0 && roll <= 10)
    : [];
}

function tokenToPins(token) {
  if (token === "-") return 0;
  if (/^[0-9]$/.test(token)) return Number(token);
  return null;
}

function repairNormalFrameRolls(tokens, fallback = []) {
  const firstToken = tokens[0];
  const secondToken = tokens[1];

  if (firstToken === "X") return [10];

  const first = tokenToPins(firstToken);

  if (Number.isInteger(first) && first >= 0 && first <= 9) {
    if (secondToken === "/" || secondToken === "X") return [first, 10 - first];

    const second = tokenToPins(secondToken);

    if (Number.isInteger(second) && second >= 0) {
      if (first + second <= 10) return [first, second];

      // OCR에서 스페어(/)를 X, 8, 9 등으로 오인해 합계가 10을 넘는 경우 보정
      return [first, 10 - first];
    }

    if (fallback.length >= 2) {
      const [fallbackFirst, fallbackSecond] = fallback;
      if (fallbackFirst === first && fallbackFirst + fallbackSecond <= 10) return [fallbackFirst, fallbackSecond];
      if (fallbackFirst === first && fallbackFirst + fallbackSecond > 10) return [first, 10 - first];
    }
  }

  if (fallback.length === 1 && fallback[0] === 10) return [10];

  if (fallback.length >= 2) {
    const [a, b] = fallback;
    if (a === 10) return [10];
    if (a >= 0 && a <= 9 && b >= 0) return a + b <= 10 ? [a, b] : [a, 10 - a];
  }

  return [];
}

function repairTenthFrameTokens(tokens, fallback = []) {
  const rolls = [];

  tokens.slice(0, 3).forEach((token, index) => {
    if (token === "X") {
      if (index === 1 && rolls[0] !== 10) {
        rolls.push(10 - rolls[0]);
        return;
      }

      if (index === 2 && rolls[0] !== 10 && rolls[0] + rolls[1] < 10) return;

      rolls.push(10);
      return;
    }

    if (token === "/") {
      const prev = rolls[rolls.length - 1];
      if (Number.isInteger(prev) && prev >= 0 && prev <= 9) rolls.push(10 - prev);
      return;
    }

    const value = tokenToPins(token);
    if (!Number.isInteger(value)) return;

    if (index === 1 && rolls[0] !== 10 && rolls[0] + value > 10) {
      rolls.push(10 - rolls[0]);
      return;
    }

    if (index === 2) {
      const bonusEarned = rolls[0] === 10 || rolls[0] + rolls[1] === 10;
      if (!bonusEarned) return;

      if (rolls[0] === 10 && rolls[1] !== 10 && rolls[1] + value > 10) {
        rolls.push(10 - rolls[1]);
        return;
      }
    }

    rolls.push(value);
  });

  if (rolls.length > 0) return rolls.slice(0, 3);

  const cleanFallback = fallback.slice(0, 3);
  if (cleanFallback.length <= 1) return cleanFallback;

  if (cleanFallback[0] !== 10 && cleanFallback[0] + cleanFallback[1] > 10) {
    cleanFallback[1] = 10 - cleanFallback[0];
  }

  if (cleanFallback.length >= 3) {
    const bonusEarned = cleanFallback[0] === 10 || cleanFallback[0] + cleanFallback[1] === 10;
    if (!bonusEarned) return cleanFallback.slice(0, 2);

    if (cleanFallback[0] === 10 && cleanFallback[1] !== 10 && cleanFallback[1] + cleanFallback[2] > 10) {
      cleanFallback[2] = 10 - cleanFallback[1];
    }
  }

  return cleanFallback;
}

export function parseGeminiFrameRolls(frame) {
  const frameNo = Number(frame?.frame);
  const mark = normalizeOcrMarkText(frame?.mark);
  const fallback = getCleanFallbackRolls(frame);

  if (!frameNo || !mark) return fallback;

  const tokens = mark.match(/X|\/|[0-9-]/g) || [];
  if (tokens.length === 0) return fallback;

  if (frameNo < 10) return repairNormalFrameRolls(tokens, fallback);

  return repairTenthFrameTokens(tokens, fallback);
}

export 
function rollsToFrameRollGroups(rolls) {
  const groups = [];
  let rollIndex = 0;

  for (let frame = 1; frame <= 10; frame++) {
    if (frame < 10) {
      const first = rolls[rollIndex];

      if (first === undefined) {
        groups.push([]);
        continue;
      }

      if (first === 10) {
        groups.push([10]);
        rollIndex += 1;
        continue;
      }

      const second = rolls[rollIndex + 1];
      groups.push(second === undefined ? [first] : [first, second]);
      rollIndex += 2;
      continue;
    }

    groups.push(rolls.slice(rollIndex, rollIndex + 3));
  }

  return groups;
}

function buildRollsFromFrameRollGroups(groups) {
  return groups.flatMap((group) => group || []).slice(0, 21);
}

function getFrameCandidateRolls(frameNo, originalRolls = []) {
  const candidates = [];
  const add = (rolls) => {
    const key = rolls.join(",");
    if (!candidates.some((candidate) => candidate.join(",") === key)) {
      candidates.push(rolls);
    }
  };

  const clean = originalRolls
    .map((roll) => Number(roll))
    .filter((roll) => Number.isInteger(roll) && roll >= 0 && roll <= 10);

  if (clean.length) add(clean);

  if (frameNo < 10) {
    add([10]);

    for (let first = 0; first <= 9; first++) {
      add([first, 10 - first]);
    }

    for (let first = 0; first <= 9; first++) {
      for (let second = 0; second <= 9 - first; second++) {
        add([first, second]);
      }
    }
  } else {
    add(clean.slice(0, 3));
  }

  return candidates;
}

export function getCumulativeScoresFromData(data) {
  const fromData = Array.isArray(data?.cumulativeScores)
    ? data.cumulativeScores
        .map((score) => Number(score))
        .filter((score) => Number.isFinite(score))
    : [];

  if (fromData.length > 0) return fromData.slice(0, 10);

  const fromFrames = Array.isArray(data?.frames)
    ? data.frames
        .slice()
        .sort((a, b) => Number(a.frame || 0) - Number(b.frame || 0))
        .map((frame) => Number(frame.total ?? frame.score ?? frame.cumulativeScore))
        .filter((score) => Number.isFinite(score))
    : [];

  return fromFrames.slice(0, 10);
}

export function repairGeminiFramesByCumulativeScores(frames, fallbackRolls = [], cumulativeScores = []) {
  if (!Array.isArray(frames) || frames.length === 0 || !Array.isArray(cumulativeScores) || cumulativeScores.length === 0) {
    return fallbackRolls;
  }

  const sortedFrames = frames
    .slice()
    .sort((a, b) => Number(a.frame || 0) - Number(b.frame || 0));

  let groups = sortedFrames.map((frame) => parseGeminiFrameRolls(frame));
  let bestRolls = buildRollsFromFrameRollGroups(groups);
  let bestPenalty = Number.POSITIVE_INFINITY;

  const targetScores = cumulativeScores.map((score) => Number(score));

  const evaluate = (nextGroups) => {
    const candidateRolls = buildRollsFromFrameRollGroups(nextGroups);
    const scoreResult = calcBowlingScore(candidateRolls);
    let penalty = 0;

    for (let i = 0; i < Math.min(10, targetScores.length); i++) {
      const target = targetScores[i];
      if (!Number.isFinite(target)) continue;

      const actual = Number(scoreResult.frames[i]?.total);
      if (!Number.isFinite(actual)) {
        penalty += 50;
        continue;
      }

      penalty += Math.abs(actual - target);
    }

    return { penalty, candidateRolls };
  };

  const initial = evaluate(groups);
  bestPenalty = initial.penalty;
  bestRolls = initial.candidateRolls;

  for (let frameIndex = 0; frameIndex < Math.min(9, groups.length); frameIndex++) {
    const frameNo = frameIndex + 1;
    const candidates = getFrameCandidateRolls(frameNo, groups[frameIndex]);

    for (const candidate of candidates) {
      const nextGroups = groups.map((group, index) => (index === frameIndex ? candidate : group));
      const result = evaluate(nextGroups);

      if (result.penalty < bestPenalty) {
        bestPenalty = result.penalty;
        bestRolls = result.candidateRolls;
        groups = nextGroups;
      }
    }
  }

  return bestPenalty <= initial.penalty ? bestRolls.slice(0, 21) : fallbackRolls;
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
