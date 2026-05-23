import React, { useState } from "react";

export default function RoomLobby({ appMode, roomCode, onCreateRoom, onJoinRoom, onLeaveRoom }) {
  const [roomNameInput, setRoomNameInput] = useState("");
  const [joinCodeInput, setJoinCodeInput] = useState("");

  if (appMode === "room") {
    return (
      <section className="roomModePanel liveRoomHeader">
        <div>
          <strong>실시간 방</strong>
          <span>{roomCode}</span>
        </div>
        <button type="button" onClick={onLeaveRoom}>방 나가기</button>
      </section>
    );
  }

  return (
    <section className="roomModePanel">
      <div className="roomModeTitle">
        <strong>실시간 방 모드</strong>
        <span>방을 만들거나 방 코드로 참여해 서로 점수판을 볼 수 있습니다.</span>
      </div>

      <div className="roomCreateBox">
        <input
          value={roomNameInput}
          onChange={(e) => setRoomNameInput(e.target.value)}
          placeholder="방 이름 선택 입력"
        />
        <button type="button" onClick={() => onCreateRoom(roomNameInput)}>방 만들기</button>
      </div>

      <div className="roomJoinBox">
        <input
          value={joinCodeInput}
          onChange={(e) => setJoinCodeInput(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder="예: 483920"
          inputMode="numeric"
          maxLength={6}
        />
        <button type="button" onClick={() => onJoinRoom(joinCodeInput)}>방 참여</button>
      </div>
    </section>
  );
}
