import React from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling.jsx";
import { BET_RULE_MODES, calculateBetSettlement, getBetRuleTitle } from "../utils/betting";

export default function LiveRoom({ roomPlayers, roomScores, currentUserId, betAmount = 0, betRule = null }) {
  const scoresByUser = new Map(roomScores.map((score) => [score.user_id, score]));
  const activeBetRule = betRule || {
    mode: Number(betAmount || 0) > 0 ? BET_RULE_MODES.CUSTOM_RANK : BET_RULE_MODES.NONE,
    baseAmount: Number(betAmount || 0),
    customRules: [],
  };
  const settlement = calculateBetSettlement(roomPlayers, roomScores, activeBetRule);
  const hasBet = activeBetRule?.mode && activeBetRule.mode !== BET_RULE_MODES.NONE;

  return (
    <section className="liveRoomBoard">
      <div className="liveRoomBoardHeader">
        <div>
          <h2>실시간 점수판</h2>
          <p>참가자가 핀을 입력할 때마다 자동으로 갱신됩니다.</p>
        </div>
        <span>{roomPlayers.length}명 참여</span>
      </div>

      {hasBet && (
        <div className="betSettlementBox">
          <div className="betSettlementHeader">
            <strong>내기 정산</strong>
            <span>{getBetRuleTitle(activeBetRule)}</span>
          </div>
          <p>현재 점수 기준 임시 정산입니다. 최종 게임 종료 후 순위 기준으로 확정하세요.</p>

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
