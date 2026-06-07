import { calcBowlingScore, normalizeGeminiRollsFromFrames, repairTenthFrameRolls } from "./bowling";

function asNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function normalizeScores(values = []) {
  return (Array.isArray(values) ? values : [])
    .map(asNumber)
    .filter((value) => value !== null && value >= 0 && value <= 300)
    .slice(0, 10);
}

function isNonDecreasing(scores = []) {
  for (let index = 1; index < scores.length; index += 1) {
    if (scores[index] < scores[index - 1]) return false;
  }
  return true;
}

function getScoreReliability(scores = []) {
  const normalized = normalizeScores(scores);
  if (normalized.length === 0) return 0;

  let reliability = normalized.length / 10;
  if (normalized.length === 10) reliability += 0.35;
  if (isNonDecreasing(normalized)) reliability += 0.25;
  if (normalized.every((score) => score >= 0 && score <= 300)) reliability += 0.1;

  return Math.min(1, reliability);
}

function pickBestCumulativeScores({ geminiScores = [], tesseractScores = [] } = {}) {
  const gemini = normalizeScores(geminiScores);
  const tesseract = normalizeScores(tesseractScores);
  const geminiReliability = getScoreReliability(gemini);
  const tesseractReliability = getScoreReliability(tesseract);

  if (tesseract.length >= 8 && tesseractReliability > geminiReliability + 0.12) return tesseract;
  if (gemini.length >= 8) return gemini;
  if (tesseract.length > gemini.length) return tesseract;
  return gemini;
}

function getFrameScoreDelta(cumulativeScores = [], frameIndex) {
  const current = asNumber(cumulativeScores[frameIndex]);
  if (current === null) return null;
  const previous = frameIndex > 0 ? asNumber(cumulativeScores[frameIndex - 1]) : 0;
  if (previous === null) return null;
  return current - previous;
}

function buildRollGroups(rolls = []) {
  const score = calcBowlingScore(Array.isArray(rolls) ? rolls : []);
  return score.frames.map((frame) => Array.isArray(frame.rolls) ? frame.rolls : []);
}

function flattenGroups(groups = []) {
  return groups.flatMap((group) => Array.isArray(group) ? group : []);
}

function normalFrameCandidates(current = []) {
  const candidates = [];
  const seen = new Set();
  const add = (rolls) => {
    const key = JSON.stringify(rolls);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(rolls);
    }
  };

  if (Array.isArray(current) && current.length > 0) add(current);
  add([10]);
  for (let first = 0; first <= 9; first += 1) add([first, 10 - first]);
  for (let first = 0; first <= 9; first += 1) {
    for (let second = 0; second <= 9 - first; second += 1) add([first, second]);
  }
  return candidates;
}

function tenthFrameCandidates(current = []) {
  const candidates = [];
  const seen = new Set();
  const add = (rolls) => {
    const valid = Array.isArray(rolls) && rolls.length >= 2 && rolls.length <= 3 && rolls.every((roll) => Number.isInteger(roll) && roll >= 0 && roll <= 10);
    if (!valid) return;
    const key = JSON.stringify(rolls);
    if (!seen.has(key)) {
      seen.add(key);
      candidates.push(rolls);
    }
  };

  if (Array.isArray(current) && current.length > 0) add(current);

  for (let a = 0; a <= 10; a += 1) {
    for (let b = 0; b <= 10; b += 1) {
      if (a < 10 && a + b < 10) {
        add([a, b]);
        continue;
      }
      if (a < 10 && a + b === 10) {
        for (let c = 0; c <= 10; c += 1) add([a, b, c]);
        continue;
      }
      if (a === 10) {
        for (let c = 0; c <= 10; c += 1) add([a, b, c]);
      }
    }
  }

  return candidates;
}

function evaluateCandidateGroups(groups, cumulativeScores = [], finalScore = null) {
  const rolls = flattenGroups(groups).slice(0, 21);
  const score = calcBowlingScore(rolls);
  let penalty = 0;

  for (let index = 0; index < 10; index += 1) {
    const target = asNumber(cumulativeScores[index]);
    if (target === null) continue;
    const actual = asNumber(score.frames[index]?.total);
    penalty += actual === null ? 80 : Math.abs(actual - target) * (index === 9 ? 2.2 : 1.2);
  }

  const targetFinal = asNumber(finalScore ?? cumulativeScores[9]);
  const actualFinal = asNumber(score.frames[9]?.total ?? score.total);
  if (targetFinal !== null) penalty += actualFinal === null ? 120 : Math.abs(actualFinal - targetFinal) * 3.5;

  if (!rolls.length) penalty += 200;
  return { penalty, rolls, score };
}

export function repairRollsByScoreEvidence({ rolls = [], cumulativeScores = [], finalScore = null } = {}) {
  const scores = normalizeScores(cumulativeScores);
  if (scores.length < 4 && !Number.isFinite(Number(finalScore))) return Array.isArray(rolls) ? rolls : [];

  let groups = buildRollGroups(rolls);
  while (groups.length < 10) groups.push([]);
  groups = groups.slice(0, 10);

  let best = evaluateCandidateGroups(groups, scores, finalScore);

  for (let frameIndex = 0; frameIndex < 10; frameIndex += 1) {
    const candidates = frameIndex === 9 ? tenthFrameCandidates(groups[frameIndex]) : normalFrameCandidates(groups[frameIndex]);
    let localBest = best;
    let localGroups = groups;

    for (const candidate of candidates) {
      const nextGroups = groups.map((group, index) => (index === frameIndex ? candidate : group));
      const evaluated = evaluateCandidateGroups(nextGroups, scores, finalScore);
      if (evaluated.penalty < localBest.penalty) {
        localBest = evaluated;
        localGroups = nextGroups;
      }
    }

    if (localBest.penalty < best.penalty) {
      groups = localGroups;
      best = localBest;
    }
  }

  return best.rolls;
}


function scoreEvidencePenalty(rolls = [], cumulativeScores = [], finalScore = null) {
  const score = calcBowlingScore(rolls);
  let penalty = 0;

  for (let index = 0; index < 10; index += 1) {
    const target = asNumber(cumulativeScores[index]);
    if (target === null) continue;
    const actual = asNumber(score.frames[index]?.total);
    if (actual === null) {
      penalty += 90;
    } else {
      penalty += Math.abs(actual - target) * (index === 9 ? 3.2 : 1.8);
    }
  }

  const targetFinal = asNumber(finalScore ?? cumulativeScores[9]);
  const actualFinal = asNumber(score.frames[9]?.total ?? score.total);
  if (targetFinal !== null) {
    penalty += actualFinal === null ? 150 : Math.abs(actualFinal - targetFinal) * 5;
  }

  return penalty;
}

function buildCandidateGroupsByFrame(baseGroups = []) {
  return Array.from({ length: 10 }, (_, index) => {
    const current = Array.isArray(baseGroups[index]) ? baseGroups[index] : [];
    return index === 9 ? tenthFrameCandidates(current) : normalFrameCandidates(current);
  });
}

function getCompletedFramePenalty(rolls = [], cumulativeScores = [], throughFrameIndex = 0) {
  const score = calcBowlingScore(rolls);
  let penalty = 0;

  for (let index = 0; index <= throughFrameIndex; index += 1) {
    const target = asNumber(cumulativeScores[index]);
    if (target === null) continue;

    // Strike/spare frames cannot be scored until bonus rolls are known.
    // Do not punish unresolved frames during beam search; otherwise long strike
    // chains are pruned early and a clearly high game such as 248 can collapse
    // into low open-frame guesses.
    const rawActual = score.frames[index]?.total;
    if (rawActual === "" || rawActual === undefined || rawActual === null) continue;

    const actual = asNumber(rawActual);
    if (actual === null) continue;

    penalty += Math.abs(actual - target) * (index >= 8 ? 2.8 : 1.8);

    // If a resolved partial total already passed the target by a lot, this
    // candidate is very unlikely to recover later.
    if (actual > target + 8) penalty += (actual - target) * 2.5;
  }

  return penalty;
}

function estimateGroupSimilarityPenalty(candidate = [], base = []) {
  if (!Array.isArray(base) || base.length === 0) return 0;
  const maxLength = Math.max(candidate.length, base.length);
  let penalty = Math.abs(candidate.length - base.length) * 1.5;
  for (let index = 0; index < maxLength; index += 1) {
    if (candidate[index] === undefined || base[index] === undefined) continue;
    if (candidate[index] !== base[index]) penalty += Math.abs(candidate[index] - base[index]) * 0.12 + 0.8;
  }
  return penalty;
}

function estimateVisualFramePrior(candidate = [], frameIndex = 0) {
  if (!Array.isArray(candidate)) return 0;
  if (frameIndex >= 9) return 0;

  // If the cumulative scores only tell us that an open frame is worth 9,
  // [0, 9] and [9, 0] are mathematically identical. Real scoreboards and
  // bowling games show 9- much more often than -9, and OCR frequently flips
  // small dash/blank symbols. Prefer the left-heavy open-frame interpretation
  // unless the frame is a spare or strike. This prevents 7~8F from showing
  // "- | 9" when the visible mark is "9 -" while the final score is already
  // correct.
  const [first, second] = candidate;
  if (candidate.length === 2 && first === 0 && second > 0 && second <= 9) return 4.5;
  if (candidate.length === 2 && first > 0 && second === 0 && first <= 9) return -0.8;
  return 0;
}

function normalizeAmbiguousOpenFramesByVisualPrior(rolls = [], cumulativeScores = []) {
  const scores = normalizeScores(cumulativeScores);
  if (!Array.isArray(rolls) || rolls.length === 0 || scores.length === 0) return rolls;

  const groups = buildRollGroups(rolls);
  let changed = false;
  const normalizedGroups = groups.map((group, frameIndex) => {
    if (frameIndex >= 9 || !Array.isArray(group) || group.length !== 2) return group;
    const [first, second] = group;
    if (first !== 0 || second <= 0 || second > 9) return group;

    const delta = getFrameScoreDelta(scores, frameIndex);
    if (delta !== null && delta !== first + second) return group;

    changed = true;
    return [second, 0];
  });

  return changed ? flattenGroups(normalizedGroups).slice(0, 21) : rolls;
}

function reconstructRollsByCumulativeBeam({ rolls = [], cumulativeScores = [], finalScore = null } = {}) {
  const scores = normalizeScores(cumulativeScores);
  const targetFinal = asNumber(finalScore ?? scores[9]);
  if (scores.length < 6 && targetFinal === null) return null;

  const baseGroups = buildRollGroups(rolls);
  while (baseGroups.length < 10) baseGroups.push([]);
  const candidatesByFrame = buildCandidateGroupsByFrame(baseGroups);
  const beamSize = 1600;
  let states = [{ groups: [], rolls: [], penalty: 0 }];

  for (let frameIndex = 0; frameIndex < 10; frameIndex += 1) {
    const nextStates = [];
    const candidates = candidatesByFrame[frameIndex];

    for (const state of states) {
      for (const candidate of candidates) {
        const groups = [...state.groups, candidate];
        const nextRolls = flattenGroups(groups);
        const evidencePenalty = getCompletedFramePenalty(nextRolls, scores, frameIndex);
        const similarityPenalty = estimateGroupSimilarityPenalty(candidate, baseGroups[frameIndex]) * 0.35;
        const visualPriorPenalty = estimateVisualFramePrior(candidate, frameIndex);
        const impossibleFuturePenalty = (() => {
          const currentTarget = asNumber(scores[frameIndex]);
          if (currentTarget === null) return 0;
          const actual = asNumber(calcBowlingScore(nextRolls).frames[frameIndex]?.total);
          if (actual === null) return 0;
          return actual > currentTarget + 18 ? 120 : 0;
        })();

        nextStates.push({
          groups,
          rolls: nextRolls,
          penalty: evidencePenalty + similarityPenalty + visualPriorPenalty + impossibleFuturePenalty,
        });
      }
    }

    nextStates.sort((a, b) => a.penalty - b.penalty);
    states = nextStates.slice(0, beamSize);
  }

  let best = null;
  for (const state of states) {
    const finalPenalty = scoreEvidencePenalty(state.rolls, scores, targetFinal);
    const totalPenalty = finalPenalty + state.penalty * 0.18;
    if (!best || totalPenalty < best.penalty) {
      best = { rolls: state.rolls.slice(0, 21), penalty: totalPenalty };
    }
  }

  if (!best) return null;
  return best;
}


function pickFinalScore({ dataFinalScore = null, cumulativeScores = [] } = {}) {
  const explicit = asNumber(dataFinalScore);
  const lastCumulative = cumulativeScores.length >= 10 ? asNumber(cumulativeScores[9]) : null;

  if (lastCumulative !== null && isNonDecreasing(cumulativeScores) && lastCumulative >= 0 && lastCumulative <= 300) {
    // The 10th cumulative score on the score row is usually the most reliable
    // final score. If the model returns a conflicting finalScore, prefer the
    // cumulative evidence instead of forcing the rolls to match the bad value.
    if (explicit === null) return lastCumulative;
    if (Math.abs(explicit - lastCumulative) > 5) return lastCumulative;
  }

  return explicit ?? lastCumulative;
}

function isExactScoreMatch(rolls = [], cumulativeScores = [], finalScore = null) {
  const score = calcBowlingScore(rolls);
  const targetFinal = asNumber(finalScore ?? cumulativeScores[9]);
  const actualFinal = asNumber(score.frames[9]?.total ?? score.total);
  if (targetFinal !== null && actualFinal !== targetFinal) return false;

  for (let index = 0; index < 10; index += 1) {
    const target = asNumber(cumulativeScores[index]);
    if (target === null) continue;
    const actual = asNumber(score.frames[index]?.total);
    if (actual !== target) return false;
  }

  return targetFinal !== null || normalizeScores(cumulativeScores).length > 0;
}

function preferScoreEvidenceRolls({ currentRolls = [], evidenceRolls = [], cumulativeScores = [], finalScore = null } = {}) {
  if (!Array.isArray(evidenceRolls) || evidenceRolls.length === 0) return currentRolls;
  const currentPenalty = scoreEvidencePenalty(currentRolls, cumulativeScores, finalScore);
  const evidencePenalty = scoreEvidencePenalty(evidenceRolls, cumulativeScores, finalScore);

  if (isExactScoreMatch(evidenceRolls, cumulativeScores, finalScore)) return evidenceRolls;
  if (evidencePenalty + 2 < currentPenalty) return evidenceRolls;

  const currentTotal = asNumber(calcBowlingScore(currentRolls).frames[9]?.total ?? calcBowlingScore(currentRolls).total);
  const evidenceTotal = asNumber(calcBowlingScore(evidenceRolls).frames[9]?.total ?? calcBowlingScore(evidenceRolls).total);
  const targetFinal = asNumber(finalScore ?? cumulativeScores[9]);

  if (targetFinal !== null && evidenceTotal === targetFinal && currentTotal !== targetFinal) {
    return evidenceRolls;
  }

  return currentRolls;
}

function getFinalMismatch(rolls = [], finalScore = null, cumulativeScores = []) {
  const target = asNumber(finalScore ?? cumulativeScores[9]);
  if (target === null) return false;
  const score = calcBowlingScore(rolls);
  const actual = asNumber(score.frames[9]?.total ?? score.total);
  return actual === null || Math.abs(actual - target) > 0;
}

export function buildAdvancedOcrResult({ data = {}, tesseractCumulativeScores = [], fallbackRolls = [] } = {}) {
  const geminiCumulativeScores = normalizeScores(data.cumulativeScores || data.cumulative_scores);
  const cumulativeScores = pickBestCumulativeScores({
    geminiScores: geminiCumulativeScores,
    tesseractScores: tesseractCumulativeScores,
  });
  const finalScore = pickFinalScore({
    dataFinalScore: data.finalScore ?? data.final_score ?? data.total ?? data.score,
    cumulativeScores,
  });

  const frameRolls = normalizeGeminiRollsFromFrames(Array.isArray(data.frames) ? data.frames : [], data.rolls || fallbackRolls);
  const baseRolls = frameRolls.length > 0 ? frameRolls : (Array.isArray(data.rolls) ? data.rolls : fallbackRolls);
  const scoreEvidenceRolls = repairRollsByScoreEvidence({
    rolls: baseRolls,
    cumulativeScores,
    finalScore,
  });
  const tenthRepairedRolls = repairTenthFrameRolls(
    scoreEvidenceRolls,
    Array.isArray(data.frames) ? data.frames : [],
    finalScore,
    cumulativeScores
  );
  const beamResult = reconstructRollsByCumulativeBeam({
    rolls: tenthRepairedRolls,
    cumulativeScores,
    finalScore,
  });
  const repairedRolls = normalizeAmbiguousOpenFramesByVisualPrior(preferScoreEvidenceRolls({
    currentRolls: tenthRepairedRolls,
    evidenceRolls: beamResult?.rolls || [],
    cumulativeScores,
    finalScore,
  }), cumulativeScores);
  const previewFrames = calcBowlingScore(repairedRolls).frames;
  const finalMismatch = getFinalMismatch(repairedRolls, finalScore, cumulativeScores);
  const scoreReliability = getScoreReliability(cumulativeScores);

  return {
    repairedRolls,
    previewFrames,
    cumulativeScores,
    finalScore,
    scoreReliability,
    finalMismatch,
    needsRetry: finalMismatch || scoreReliability < 0.65 || repairedRolls.length === 0,
  };
}

export function getOcrFailureGuide({ cumulativeScores = [], finalScore = null, finalMismatch = false } = {}) {
  const scores = normalizeScores(cumulativeScores);
  if (scores.length < 6) return "누적 점수가 충분히 보이지 않습니다. 점수 한 줄의 아래 누적 점수까지 포함해서 다시 촬영해주세요.";
  if (finalScore === null || finalScore === undefined || Number.isNaN(Number(finalScore))) return "최종 점수가 잘 보이지 않습니다. 10프레임 오른쪽 또는 하단 최종 점수까지 보이게 다시 촬영해주세요.";
  if (finalMismatch) return "투구값과 최종 점수 검산이 맞지 않습니다. 반사광을 피하고 점수판을 정면에서 다시 촬영해주세요.";
  return "분석이 불안정합니다. 내 점수 한 줄만 선택해서 다시 분석해주세요.";
}
