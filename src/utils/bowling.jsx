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
    const rawMark = String(originalRolls?.mark || "").toUpperCase();
    add(clean.slice(0, 3));

    // 10프레임은 OCR이 X 3개를 1개로 압축하거나 9프레임과 섞는 경우가 많다.
    // 누적 점수 교차검증에서 복구할 수 있도록 가능한 합법 10프레임 후보를 충분히 열어둔다.
    add([10, 10, 10]);
    add([10, 10, 0]);
    add([10, 0, 10]);

    for (let second = 0; second <= 10; second++) {
      if (second === 10) {
        for (let third = 0; third <= 10; third++) add([10, 10, third]);
      } else {
        for (let third = 0; third <= 10 - second; third++) add([10, second, third]);
      }
    }

    for (let first = 0; first <= 9; first++) {
      const spareSecond = 10 - first;
      for (let third = 0; third <= 10; third++) add([first, spareSecond, third]);

      for (let second = 0; second < spareSecond; second++) add([first, second]);
    }
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

  for (let frameIndex = 0; frameIndex < Math.min(10, groups.length); frameIndex++) {
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


  // 9~10프레임 경계가 붙어 보이는 점수판은 Gemini가 9프레임 X를 -/로,
  // 10프레임 XXX를 X 하나로 줄이는 경우가 잦다. 두 프레임을 쌍으로 다시 평가한다.
  if (groups.length >= 10 && targetScores.length >= 10) {
    const ninthCandidates = getFrameCandidateRolls(9, groups[8]);
    const tenthCandidates = getFrameCandidateRolls(10, groups[9]);

    for (const ninthCandidate of ninthCandidates) {
      for (const tenthCandidate of tenthCandidates) {
        const nextGroups = groups.map((group, index) => {
          if (index === 8) return ninthCandidate;
          if (index === 9) return tenthCandidate;
          return group;
        });
        const result = evaluate(nextGroups);

        if (result.penalty < bestPenalty) {
          bestPenalty = result.penalty;
          bestRolls = result.candidateRolls;
          groups = nextGroups;
        }
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
