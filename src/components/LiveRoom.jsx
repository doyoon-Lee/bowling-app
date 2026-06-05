import React from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling.jsx";
import { BET_RULE_MODES, calculateBetSettlement, getBetRuleTitle } from "../utils/betting";

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

export default function LiveRoom({ roomPlayers, roomScores, currentUserId, betAmount = 0, betRule = null }) {
  const scoresByUser = new Map(roomScores.map((score) => [score.user_id, score]));
  const activeBetRule = betRule || {
    mode: Number(betAmount || 0) > 0 ? BET_RULE_MODES.CUSTOM_RANK : BET_RULE_MODES.NONE,
    baseAmount: Number(betAmount || 0),
    customRules: [],
  };

  const settlement = calculateBetSettlement(roomPlayers, roomScores, activeBetRule);
  const hasBet = activeBetRule?.mode && activeBetRule.mode !== BET_RULE_MODES.NONE;
  const hasPlayers = roomPlayers.length > 0;
  const isFinished =
    hasPlayers &&
    roomPlayers.every((player) => isPlayerGameComplete(scoresByUser.get(player.user_id)));

  const rankedResults = roomPlayers
    .map((player) => {
      const score = scoresByUser.get(player.user_id);
      const settlementItem = settlement.find((item) => item.userId === player.user_id);

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
          <p>참가자가 핀을 입력할 때마다 자동으로 갱신됩니다.</p>
        </div>
        <span>{roomPlayers.length}명 참여</span>
      </div>

      {isFinished && (
        <div className="gameResultBox">
          <div className="gameResultHeader">
            <div>
              <strong>게임 종료 결과</strong>
              <p>10프레임까지 입력된 최종 점수 기준입니다.</p>
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
                      {item.net >= 0 ? "+" : "-"}{Math.abs(item.net).toLocaleString()}원
                    </em>
                  )}
                </div>
              </div>
            ))}
          </div>

          {hasBet && (
            <div className="gameResultSettlementNote">
              <strong>정산 요약</strong>
              <p>
                +는 받을 금액, -는 잃고 있는 금액입니다. 실제 송금 전 동점/핸디 여부는 참가자끼리 확인하세요.
              </p>
            </div>
          )}
        </div>
      )}

      {hasBet && !isFinished && (
        <div className="betSettlementBox">
          <div className="betSettlementHeader">
            <strong>내기 정산</strong>
            <span>{getBetRuleTitle(activeBetRule)}</span>
          </div>
          <p>현재 점수 기준 임시 정산입니다. 게임 종료 후 최종 순위로 확정됩니다.</p>

          <div className="betSettlementList">
            {settlement.map((item) => (
              <div className="betSettlementItem" key={item.userId}>
                <div>
                  <strong>{item.rank}등 {item.name}</strong>
                  <span>
                    {item.total}점 · 낼 돈 {Number(item.pay || 0).toLocaleString()}원 · 받을 돈 {Number(item.receive || 0).toLocaleString()}원
                  </span>
                </div>
                <em className={item.net >= 0 ? "positive" : "negative"}>
                  {item.net >= 0 ? "+" : "-"}{Math.abs(item.net).toLocaleString()}원
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
