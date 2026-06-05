export const BET_RULE_MODES = {
  NONE: "none",
  EQUAL: "equal",
  CUSTOM_RANK: "custom_rank",
};

export function normalizeMoney(value) {
  const numberValue = Number(value || 0);
  if (!Number.isFinite(numberValue)) return 0;
  return Math.max(0, Math.floor(numberValue / 1000) * 1000);
}

export function createDefaultCustomRankRules(baseAmount, maxPlayers = 6) {
  const amount = normalizeMoney(baseAmount);

  return Array.from({ length: Math.max(2, maxPlayers) }, (_, index) => {
    const rank = index + 1;

    if (rank === 1) return { rank, pay: 0 };

    if (amount === 5000) {
      return { rank, pay: Math.max(0, 2000 + (rank - 2) * 3000) };
    }

    if (amount === 2000) {
      return { rank, pay: Math.max(0, (rank - 1) * 1000) };
    }

    return { rank, pay: Math.max(0, (rank - 1) * amount) };
  });
}

export function createBetRule({ mode = BET_RULE_MODES.NONE, baseAmount = 0, customRules = [] } = {}) {
  const normalizedMode = mode || BET_RULE_MODES.NONE;
  const amount = normalizeMoney(baseAmount);

  if (normalizedMode === BET_RULE_MODES.NONE) {
    return {
      mode: BET_RULE_MODES.NONE,
      baseAmount: 0,
      customRules: [],
    };
  }

  if (normalizedMode === BET_RULE_MODES.EQUAL && amount <= 0) {
    return {
      mode: BET_RULE_MODES.NONE,
      baseAmount: 0,
      customRules: [],
    };
  }

  if (normalizedMode === BET_RULE_MODES.EQUAL) {
    return {
      mode: BET_RULE_MODES.EQUAL,
      baseAmount: amount,
      customRules: [],
    };
  }

  const normalizedCustomRules = (customRules.length ? customRules : createDefaultCustomRankRules(amount)).map((rule) => ({
    rank: Number(rule.rank),
    pay: normalizeMoney(rule.pay),
  }));

  return {
    mode: BET_RULE_MODES.CUSTOM_RANK,
    baseAmount: amount,
    customRules: normalizedCustomRules,
  };
}

export function getBetRuleTitle(betRule) {
  if (!betRule || betRule.mode === BET_RULE_MODES.NONE) return "내기 없이";
  if (betRule.mode === BET_RULE_MODES.EQUAL) {
    return `균등 정산 ${Number(betRule.baseAmount || 0).toLocaleString()}원`;
  }
  return `차등 정산 ${Number(betRule.baseAmount || 0).toLocaleString()}원 기준`;
}

export function calculateBetSettlement(roomPlayers, roomScores, betRule) {
  if (!betRule || betRule.mode === BET_RULE_MODES.NONE || roomPlayers.length < 2) return [];

  const scoresByUser = new Map(roomScores.map((score) => [score.user_id, score]));
  const ranked = roomPlayers
    .map((player) => ({
      userId: player.user_id,
      name: player.player_name,
      total: Number(scoresByUser.get(player.user_id)?.total || 0),
    }))
    .sort((a, b) => b.total - a.total);

  const rows = ranked.map((player, index) => {
    const rank = index + 1;
    let pay = 0;

    if (rank > 1 && betRule.mode === BET_RULE_MODES.EQUAL) {
      pay = normalizeMoney(betRule.baseAmount);
    }

    if (rank > 1 && betRule.mode === BET_RULE_MODES.CUSTOM_RANK) {
      if (ranked.length === 2 && rank === 2) {
        pay = normalizeMoney(betRule.baseAmount);
      } else {
        const customRule = betRule.customRules?.find((rule) => Number(rule.rank) === rank);
        pay = normalizeMoney(customRule?.pay ?? (rank - 1) * Number(betRule.baseAmount || 0));
      }
    }

    return {
      ...player,
      rank,
      pay,
      receive: 0,
      net: -pay,
    };
  });

  const totalPool = rows.reduce((sum, row) => sum + row.pay, 0);

  return rows.map((row) => {
    if (row.rank !== 1) return row;
    return {
      ...row,
      receive: totalPool,
      net: totalPool,
    };
  });
}

export function summarizeBetSettlement(settlementsByGame = []) {
  const totals = new Map();

  settlementsByGame.flat().forEach((item) => {
    const key = item.userId;
    const current = totals.get(key) || {
      userId: item.userId,
      name: item.name,
      net: 0,
      pay: 0,
      receive: 0,
      games: 0,
    };

    current.net += Number(item.net || 0);
    current.pay += Number(item.pay || 0);
    current.receive += Number(item.receive || 0);
    current.games += 1;
    totals.set(key, current);
  });

  return Array.from(totals.values()).sort((a, b) => b.net - a.net);
}


export function ensureBetRule(betRule, betAmount = 0) {
  if (betRule?.mode && betRule.mode !== BET_RULE_MODES.NONE) {
    const explicitBetAmount = normalizeMoney(betAmount);
    const ruleBaseAmount = normalizeMoney(betRule.baseAmount);
    const baseAmount = explicitBetAmount > 0 ? explicitBetAmount : ruleBaseAmount;

    return createBetRule({
      mode: betRule.mode,
      baseAmount,
      customRules: betRule.customRules || [],
    });
  }

  const amount = normalizeMoney(betAmount);
  if (amount <= 0) return createBetRule({ mode: BET_RULE_MODES.NONE });

  return createBetRule({
    mode: BET_RULE_MODES.CUSTOM_RANK,
    baseAmount: amount,
    customRules: createDefaultCustomRankRules(amount, 6),
  });
}
