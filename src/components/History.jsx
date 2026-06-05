import React, { useEffect, useMemo, useState } from "react";
import { displayTotal, renderFrameMark } from "../utils/bowling.jsx";
import { getDayAverage, getDayHigh, getKoreaDateLabel } from "../utils/date";

const getMonthKey = (dateKey) => String(dateKey || "").slice(0, 7);

const getMonthLabel = (monthKey) => {
  if (!monthKey) return "전체";
  const [year, month] = monthKey.split("-");
  return `${year}년 ${Number(month)}월`;
};

export default function History({ sortedDateKeys, groupedRecords, onDeleteRecord }) {
  const monthKeys = useMemo(() => {
    const uniqueMonths = new Set(sortedDateKeys.map(getMonthKey).filter(Boolean));
    return Array.from(uniqueMonths).sort((a, b) => b.localeCompare(a));
  }, [sortedDateKeys]);

  const [selectedMonth, setSelectedMonth] = useState("all");
  const [selectedDate, setSelectedDate] = useState("all");

  useEffect(() => {
    if (selectedMonth !== "all" && !monthKeys.includes(selectedMonth)) {
      setSelectedMonth(monthKeys[0] || "all");
      setSelectedDate("all");
    }
  }, [monthKeys, selectedMonth]);

  const visibleDateKeys = useMemo(() => {
    return sortedDateKeys.filter((dateKey) => selectedMonth === "all" || getMonthKey(dateKey) === selectedMonth);
  }, [sortedDateKeys, selectedMonth]);

  useEffect(() => {
    if (selectedDate !== "all" && !visibleDateKeys.includes(selectedDate)) {
      setSelectedDate("all");
    }
  }, [visibleDateKeys, selectedDate]);

  const displayDateKeys = selectedDate === "all"
    ? visibleDateKeys
    : visibleDateKeys.filter((dateKey) => dateKey === selectedDate);

  const monthRecords = visibleDateKeys.flatMap((dateKey) => groupedRecords[dateKey] || []);

  return (
    <section className="history">
      <div className="historyTitleRow">
        <h2>날짜별 기록</h2>
        {sortedDateKeys.length > 0 && <span>{sortedDateKeys.length}일 기록</span>}
      </div>

      {sortedDateKeys.length === 0 ? (
        <div className="empty">저장된 기록이 없습니다.</div>
      ) : (
        <>
          <div className="historyControls">
            <label>
              <span>월 선택</span>
              <select
                value={selectedMonth}
                onChange={(event) => {
                  setSelectedMonth(event.target.value);
                  setSelectedDate("all");
                }}
              >
                <option value="all">전체 기간</option>
                {monthKeys.map((monthKey) => (
                  <option value={monthKey} key={monthKey}>
                    {getMonthLabel(monthKey)}
                  </option>
                ))}
              </select>
            </label>

            <div className="historySummaryPills">
              <span>{monthRecords.length}게임</span>
              <span>AVG {getDayAverage(monthRecords)}</span>
              <span>HIGH {getDayHigh(monthRecords)}</span>
            </div>
          </div>

          <div className="dateChipScroller" aria-label="날짜 선택">
            <button
              type="button"
              className={selectedDate === "all" ? "active" : ""}
              onClick={() => setSelectedDate("all")}
            >
              전체
            </button>
            {visibleDateKeys.map((dateKey) => {
              const records = groupedRecords[dateKey] || [];
              return (
                <button
                  type="button"
                  className={selectedDate === dateKey ? "active" : ""}
                  key={dateKey}
                  onClick={() => setSelectedDate(dateKey)}
                >
                  <strong>{getKoreaDateLabel(dateKey).replace(/^\d{4}년\s*/, "")}</strong>
                  <span>{records.length}게임</span>
                </button>
              );
            })}
          </div>

          <div className="historyList">
            {displayDateKeys.map((dateKey) => {
              const dayRecords = groupedRecords[dateKey] || [];
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
            })}
          </div>
        </>
      )}
    </section>
  );
}
