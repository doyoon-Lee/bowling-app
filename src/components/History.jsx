import React from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling";
import { getDayAverage, getDayHigh, getKoreaDateLabel } from "../utils/date";

export default function History({ sortedDateKeys, groupedRecords, onDeleteRecord }) {
  return (
    <section className="history">
      <h2>날짜별 기록</h2>

      {sortedDateKeys.length === 0 ? (
        <div className="empty">저장된 기록이 없습니다.</div>
      ) : (
        sortedDateKeys.map((dateKey) => {
          const dayRecords = groupedRecords[dateKey];
          return (
            <section className="dateGroup" key={dateKey}>
              <div className="dateHeader">
                <div>
                  <strong>{getKoreaDateLabel(dateKey)}</strong>
                  <span>{dayRecords.length}게임</span>
                </div>
                <div className="dateStats">
                  <span>AVG {getDayAverage(dayRecords)}</span>
                  <span>HIGH {getDayHigh(dayRecords)}</span>
                </div>
              </div>

              {dayRecords.map((record) => (
                <details className="record compactRecord" key={record.id}>
                  <summary>
                    <div>
                      <strong>{record.total}점</strong>
                      <p>{record.player_name} · {record.place || "장소 미입력"}</p>
                    </div>
                    <span>{new Date(record.created_at).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
                  </summary>

                  <div className="recordDetail">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onDeleteRecord(record.id);
                      }}
                    >
                      삭제
                    </button>
                    <div className="recordFrames">
                      {(record.frames || []).map((frame) => (
                        <div className="recordFrame" key={frame.frame}>
                          <span>{frame.frame}</span>
                          <b>{renderFrameMark(frame.mark)}</b>
                          <em>{displayTotal(frame.total)}</em>
                        </div>
                      ))}
                    </div>
                  </div>
                </details>
              ))}
            </section>
          );
        })
      )}
    </section>
  );
}
