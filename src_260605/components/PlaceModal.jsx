import React from "react";

export default function PlaceModal({
  isSearchingPlace,
  placeSearchMessage,
  placeCandidates,
  onSelect,
  onClose,
}) {
  return (
    <div className="placeModalBackdrop" onClick={onClose}>
      <div className="placeModal" onClick={(e) => e.stopPropagation()}>
        <div className="placeModalHeader">
          <div>
            <strong>주변 볼링장</strong>
            <span>현재 위치 기준 최대 3개</span>
          </div>
          <button onClick={onClose}>닫기</button>
        </div>

        {isSearchingPlace && <div className="placeLoading">주변 볼링장을 검색 중입니다...</div>}
        {!isSearchingPlace && placeSearchMessage && <div className="placeMessage">{placeSearchMessage}</div>}

        {!isSearchingPlace && placeCandidates.length > 0 && (
          <div className="placeList">
            {placeCandidates.map((candidate) => (
              <button key={candidate.id} onClick={() => onSelect(candidate)}>
                <strong>{candidate.name}</strong>
                <span>{candidate.distance}</span>
                <em>{candidate.address}</em>
              </button>
            ))}
          </div>
        )}

        <button className="manualPlaceButton" onClick={onClose}>
          직접 입력하기
        </button>
      </div>
    </div>
  );
}
