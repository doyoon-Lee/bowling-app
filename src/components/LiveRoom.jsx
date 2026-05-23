import React from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling";

function getInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

function getPlayerScore(scores, player) {
  return scores.find((score) => score.user_id === player.user_id) || null;
}

function getScoreRows(roomScores = [], roomPlayers = []) {
  const rowsFromPlayers = roomPlayers.map((player) => {
    const score = getPlayerScore(roomScores, player);
    return {
      user_id: player.user_id,
      player_name: player.player_name,
      total: score?.total || 0,
      frames: score?.frames || [],
      updated_at: score?.updated_at,
    };
  });

  const playerIds = new Set(rowsFromPlayers.map((row) => row.user_id));
  const extraScores = roomScores
    .filter((score) => !playerIds.has(score.user_id))
    .map((score) => ({
      user_id: score.user_id,
      player_name: score.player_name,
      total: score.total || 0,
      frames: score.frames || [],
      updated_at: score.updated_at,
    }));

  return [...rowsFromPlayers, ...extraScores];
}

export default function LiveRoom({ roomPlayers, roomScores, currentUserId }) {
  const rows = getScoreRows(roomScores, roomPlayers);
  const participantCount = roomPlayers.length || rows.length || 0;

  return (
    <section className="liveRoomBoard liveRoomCleanBoard">
      <div className="liveRoomCleanHeader">
        <div>
          <h2>실시간 점수판</h2>
          <p>참가자가 핀을 입력할 때마다 자동으로 갱신됩니다.</p>
        </div>

        <div className="liveRoomHeaderActions">
          <span className="liveRoomCodeBadge">{roomCode}</span>
          <span className="liveRoomCountBadge">{participantCount}명 참여</span>
          {onLeaveRoom && (
            <button type="button" className="liveRoomLeaveButton" onClick={onLeaveRoom}>
              방 나가기
            </button>
          )}
        </div>
      </div>

      {rows.length === 0 ? (
        <div className="liveRoomEmpty">아직 참가자 점수가 없습니다.</div>
      ) : (
        <div className="liveRoomPlayerGrid">
          {rows.map((score) => {
            const isMe = currentUserId && score.user_id === currentUserId;

            return (
              <article className={isMe ? "liveRoomPlayerCard isMe" : "liveRoomPlayerCard"} key={score.user_id || score.player_name}>
                <div className="liveRoomPlayerTop">
                  <div className="liveRoomPlayerIdentity">
                    <div className="liveRoomAvatar">{isMe ? "나" : getInitial(score.player_name)}</div>
                    <div>
                      <strong>{score.player_name || "참가자"}</strong>
                      {isMe && <span>내 점수</span>}
                    </div>
                  </div>

                  <div className="liveRoomTotalBox">
                    <span>총점</span>
                    <strong>{score.total || 0}</strong>
                  </div>
                </div>

                <div className="liveRoomFrameStrip" aria-label="{score.player_name} 점수판">
                  {Array.from({ length: 10 }, (_, index) => {
                    const frame = (score.frames || [])[index];

                    return (
                      <div className="liveRoomFrameCell" key={index}>
                        <div className="liveRoomFrameNo">{index + 1}</div>
                        <div className="liveRoomFrameMark">{renderFrameMark(frame?.mark)}</div>
                        <div className="liveRoomFrameTotal">{displayTotal(frame?.total)}</div>
                      </div>
                    );
                  })}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
