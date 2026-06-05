import React from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling.jsx";
import { BET_RULE_MODES, calculateBetSettlement, getBetRuleTitle, summarizeBetSettlement, ensureBetRule } from "../utils/betting";

function isPlayerGameComplete(score) {
  const frames = score?.frames || [];
  const tenthFrame = frames[9];
  return frames.length >= 10 && tenthFrame && typeof score?.total === "number";
}

function getRankLabel(rank) {
  if (rank === 1) return "1등";
  if (rank === 2) return "2등";
  if (rank === 3) return "3등";
  return `${rank}등`;
}

function formatMoney(value) {
  const amount = Number(value || 0);
  return `${amount >= 0 ? "+" : "-"}${Math.abs(amount).toLocaleString()}원`;
}

export default function LiveRoom({
  roomPlayers,
  roomScores,
  currentUserId,
  betAmount = 0,
  betRule = null,
  roomRounds = [],
  onFinishCurrentRound,
  onFinalSettlement,
}) {
  const scoresByUser = new Map(roomScores.map((score) => [score.user_id, score]));
  const activeBetRule = ensureBetRule(betRule, betAmount);

  const hasBet = activeBetRule?.mode && activeBetRule.mode !== BET_RULE_MODES.NONE;
  const hasPlayers = roomPlayers.length > 0;
  const isFinished =
    hasPlayers &&
    roomPlayers.every((player) => isPlayerGameComplete(scoresByUser.get(player.user_id)));

  const currentSettlement = calculateBetSettlement(roomPlayers, roomScores, activeBetRule);
  const cumulativeSettlement = summarizeBetSettlement(
    roomRounds.map((round) => {
      if (Array.isArray(round.settlement) && round.settlement.length > 0) return round.settlement;

      const roundPlayers = round.result_data?.players || roomPlayers;
      const roundScores = round.result_data?.scores || [];
      const roundBetRule = ensureBetRule(round.bet_rule || activeBetRule, Number(round.bet_amount || activeBetRule.baseAmount || 0));
      return calculateBetSettlement(roundPlayers, roundScores, roundBetRule);
    })
  );

  const rankedResults = roomPlayers
    .map((player) => {
      const score = scoresByUser.get(player.user_id);
      const settlementItem = currentSettlement.find((item) => item.userId === player.user_id);

      return {
        userId: player.user_id,
        name: player.player_name,
        total: Number(score?.total || 0),
        net: Number(settlementItem?.net || 0),
        pay: Number(settlementItem?.pay || 0),
        receive: Number(settlementItem?.receive || 0),
      };
    })
    .sort((a, b) => b.total - a.total)
    .map((item, index) => ({
      ...item,
      rank: index + 1,
    }));

  return (
    <section className="liveRoomBoard">
      <div className="liveRoomBoardHeader">
        <div>
          <h2>실시간 점수판</h2>
          <p>모든 플레이어가 10프레임까지 입력되면 현재 판을 저장하고 다음 판으로 넘어갈 수 있습니다.</p>
        </div>
        <span>{roomPlayers.length}명 참여</span>
      </div>

      {isFinished && roomRounds.length > 0 && (
        <div className="cumulativeSettlementBox">
          <div className="cumulativeSettlementHeader">
            <div>
              <strong>누적 정산</strong>
              <p>현재까지 저장된 {roomRounds.length}판 기준입니다.</p>
            </div>
            {hasBet && <span>{getBetRuleTitle(activeBetRule)}</span>}
          </div>

          {hasBet ? (
            <div className="cumulativeSettlementList">
              {cumulativeSettlement.map((item) => (
                <div className="cumulativeSettlementItem" key={item.userId}>
                  <strong>{item.name}</strong>
                  <em className={item.net >= 0 ? "positive" : "negative"}>{formatMoney(item.net)}</em>
                </div>
              ))}
            </div>
          ) : (
            <p className="settlementMuted">내기 없이 진행 중입니다. 판별 점수 기록만 누적됩니다.</p>
          )}

          <div className="roundHistoryList">
            {roomRounds.map((round) => (
              <div className="roundHistoryItem" key={round.id}>
                <strong>{round.round_number || "-"}판</strong>
                <span>
                  {(round.result_data?.scores || [])
                    .map((score) => `${score.player_name || "플레이어"} ${score.total || 0}점`)
                    .join(" · ")}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {isFinished && (
        <div className="gameResultBox">
          <div className="gameResultHeader">
            <div>
              <strong>현재 판 종료 결과</strong>
              <p>10프레임까지 입력된 최종 점수 기준입니다. 판 저장 후 다음 판으로 넘어갈 수 있습니다.</p>
            </div>
            <span>최종 순위</span>
          </div>

          <div className="gameResultList">
            {rankedResults.map((item) => (
              <div className={item.rank === 1 ? "gameResultItem winner" : "gameResultItem"} key={item.userId}>
                <div className="gameResultRank">
                  <strong>{getRankLabel(item.rank)}</strong>
                  <span>{item.name}</span>
                </div>

                <div className="gameResultScore">
                  <strong>{item.total}점</strong>
                  {hasBet && (
                    <em className={item.net >= 0 ? "positive" : "negative"}>
                      {formatMoney(item.net)}
                    </em>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="roomRoundActions">
            <button type="button" onClick={onFinishCurrentRound}>
              전원 완료 후 현재 판 저장
            </button>
            <button type="button" className="secondary" onClick={onFinalSettlement}>
              게임종료 / 누적 정산
            </button>
          </div>
        </div>
      )}

      {hasBet && !isFinished && (
        <div className="betSettlementBox">
          <div className="betSettlementHeader">
            <strong>현재 판 임시 정산</strong>
            <span>{getBetRuleTitle(activeBetRule)}</span>
          </div>
          <p>현재 점수 기준 임시 정산입니다. 판 종료 후 저장해야 누적 정산에 반영됩니다.</p>

          <div className="betSettlementList">
            {currentSettlement.map((item) => (
              <div className="betSettlementItem" key={item.userId}>
                <div>
                  <strong>{item.rank}등 {item.name}</strong>
                  <span>
                    {item.total}점 · 낼 돈 {Number(item.pay || 0).toLocaleString()}원 · 받을 돈 {Number(item.receive || 0).toLocaleString()}원
                  </span>
                </div>
                <em className={item.net >= 0 ? "positive" : "negative"}>
                  {formatMoney(item.net)}
                </em>
              </div>
            ))}
          </div>
        </div>
      )}

      {roomPlayers.length === 0 ? (
        <div className="empty">아직 참가자가 없습니다.</div>
      ) : (
        <div className="roomPlayerGrid">
          {roomPlayers.map((player) => {
            const score = scoresByUser.get(player.user_id);
            const frames = score?.frames || [];
            const total = score?.total ?? 0;
            const isMe = player.user_id === currentUserId;

            return (
              <div className={isMe ? "roomPlayerCard me" : "roomPlayerCard"} key={player.user_id}>
                <div className="roomPlayerTop">
                  <strong>{player.player_name}</strong>
                  {isMe && <span>나</span>}
                </div>

                <div className="roomPlayerTotal">{total}</div>

                <div className="miniFrames">
                  {Array.from({ length: 10 }, (_, index) => {
                    const frame = frames[index];
                    return (
                      <div className="miniFrame" key={index}>
                        <span>{index + 1}</span>
                        <strong>{renderFrameMark(frame?.mark)}</strong>
                        <em>{displayTotal(frame?.total)}</em>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
