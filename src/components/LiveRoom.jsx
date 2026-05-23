import React from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling";

function getInitial(name) {
  return String(name || "?").trim().charAt(0).toUpperCase() || "?";
}

export default function LiveRoom({
  roomCode,
  roomScores = [],
  roomPlayers = [],
  currentUserId,
  onLeaveRoom,
}) {
  const rows = roomScores;
  const participantCount = roomPlayers.length || rows.length || 0;

  return (
    <section className="liveRoomCleanBoard">
      <div className="liveRoomCleanHeader">
        <div>
          <h2>실시간 점수판</h2>
          <p>참가자가 핀을 입력할 때마다 자동으로 갱신됩니다.</p>
        </div>

        <div className="liveRoomHeaderActions">
          <span className="liveRoomCodeBadge">{roomCode}</span>
          <span className="liveRoomCountBadge">{participantCount}명 참여</span>
          {onLeaveRoom && (
            <button className="liveRoomLeaveButton" onClick={onLeaveRoom}>
              방 나가기
            </button>
          )}
        </div>
      </div>

      <div className="liveRoomPlayerGrid">
        {rows.map((score) => {
          const isMe = currentUserId && score.user_id === currentUserId;

          return (
            <article
              className={isMe ? "liveRoomPlayerCard isMe" : "liveRoomPlayerCard"}
              key={score.user_id || score.player_name}
            >
              <div className="liveRoomPlayerTop">
                <div className="liveRoomPlayerIdentity">
                  <div className="liveRoomAvatar">
                    {isMe ? "나" : getInitial(score.player_name)}
                  </div>
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

              <div className="liveRoomFrameStrip">
                {Array.from({ length: 10 }, (_, index) => {
                  const frame = (score.frames || [])[index];

                  return (
                    <div className="liveRoomFrameCell" key={index}>
                      <div className="liveRoomFrameNo">{index + 1}</div>
                      <div className="liveRoomFrameMark">
                        {renderFrameMark(frame?.mark)}
                      </div>
                      <div className="liveRoomFrameTotal">
                        {displayTotal(frame?.total)}
                      </div>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}