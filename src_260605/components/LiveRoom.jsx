import React from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling.jsx";

export default function LiveRoom({ roomPlayers, roomScores, currentUserId }) {
  const scoresByUser = new Map(roomScores.map((score) => [score.user_id, score]));

  return (
    <section className="liveRoomBoard">
      <div className="liveRoomBoardHeader">
        <div>
          <h2>실시간 점수판</h2>
          <p>참가자가 핀을 입력할 때마다 자동으로 갱신됩니다.</p>
        </div>
        <span>{roomPlayers.length}명 참여</span>
      </div>

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
