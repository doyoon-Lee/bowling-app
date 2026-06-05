import React, { useEffect, useRef } from "react";
import { displayTotal, getFrameRollLimit, renderFrameMark } from "../utils/bowling.jsx";
import { BET_RULE_MODES, calculateBetSettlement, getBetRuleTitle, summarizeBetSettlement, ensureBetRule } from "../utils/betting";


function MiniFrameScoreboard({ frames, rolls = [] }) {
  const miniFramesRef = useRef(null);
  const next = getFrameRollLimit(Array.isArray(rolls) ? rolls : []);

  useEffect(() => {
    const board = miniFramesRef.current;
    if (!board) return;

    const activeFrameIndex = next?.frame ? next.frame - 1 : 9;
    const activeFrame = board.children?.[activeFrameIndex];
    if (!activeFrame) return;

    const boardLeft = board.scrollLeft;
    const boardRight = boardLeft + board.clientWidth;
    const frameLeft = activeFrame.offsetLeft;
    const frameRight = frameLeft + activeFrame.offsetWidth;
    const padding = 8;

    if (frameLeft < boardLeft + padding || frameRight > boardRight - padding) {
      board.scrollTo({
        left: Math.max(frameLeft - padding, 0),
        behavior: "smooth",
      });
    }
  }, [next?.frame, rolls.length]);

  return (
    <div className="miniFrames" ref={miniFramesRef}>
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
  );
}

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

  const hasCurrentRoundProgress = roomScores.some((score) => {
    const rolls = Array.isArray(score?.rolls) ? score.rolls : [];
    const frames = Array.isArray(score?.frames) ? score.frames : [];
    return rolls.length > 0 || frames.some((frame) => frame?.mark || Number(frame?.total || 0) > 0);
  });

  const emptyCurrentSettlement = roomPlayers.map((player, index) => ({
    userId: player.user_id,
    name: player.player_name,
    total: 0,
    rank: index + 1,
    pay: 0,
    receive: 0,
    net: 0,
  }));

  const currentSettlement = hasCurrentRoundProgress
    ? calculateBetSettlement(roomPlayers, roomScores, activeBetRule)
    : emptyCurrentSettlement;
  const cumulativeSettlement = summarizeBetSettlement(
    roomRounds.map((round) => {
      const roundPlayers = round.result_data?.players || roomPlayers;
      const roundScores = round.result_data?.scores || [];
      const roundBetRule = ensureBetRule(activeBetRule || round.bet_rule, Number(activeBetRule?.baseAmount || round.bet_amount || 0));
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

      {roomRounds.length > 0 && (
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

                <MiniFrameScoreboard frames={frames} rolls={score?.rolls || []} />
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
