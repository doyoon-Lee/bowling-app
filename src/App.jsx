import React, { useEffect, useMemo, useState } from "react";
import "./App.css";

let supabase = null;

async function getSupabaseClient() {
  if (supabase) return supabase;

  const url = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!url || !anonKey) return null;

  const { createClient } = await import("@supabase/supabase-js");
  supabase = createClient(url, anonKey);
  return supabase;
}

function formatRollMark(value) {
  if (value === undefined || value === null) return "";
  if (value === 10) return "X";
  if (value === 0) return "-";
  return String(value);
}

function calcBowlingScore(rolls) {
  let score = 0;
  let rollIndex = 0;
  const frames = [];

  for (let frame = 1; frame <= 10; frame++) {
    const first = rolls[rollIndex];
    const second = rolls[rollIndex + 1];

    if (frame < 10) {
      if (first === undefined) {
        frames.push({ frame, mark: "", total: "" });
        continue;
      }

      if (first === 10) {
        const bonus1 = Number(rolls[rollIndex + 1] ?? 0);
        const bonus2 = Number(rolls[rollIndex + 2] ?? 0);
        score += 10 + bonus1 + bonus2;
        frames.push({ frame, mark: "X", total: score });
        rollIndex += 1;
        continue;
      }

      if (second === undefined) {
        frames.push({ frame, mark: formatRollMark(first), total: "" });
        continue;
      }

      if (first + second === 10) {
        const bonus = Number(rolls[rollIndex + 2] ?? 0);
        score += 10 + bonus;
        frames.push({ frame, mark: `${formatRollMark(first)}/`, total: score });
      } else {
        score += first + second;
        frames.push({ frame, mark: `${formatRollMark(first)} ${formatRollMark(second)}`, total: score });
      }

      rollIndex += 2;
      continue;
    }

    const tenthRolls = rolls.slice(rollIndex);
    if (tenthRolls.length === 0) {
      frames.push({ frame, mark: "", total: "" });
      continue;
    }

    const [a, b, c] = tenthRolls;
    let tenthMark = formatRollMark(a);

    if (b !== undefined) {
      if (a !== 10 && a + b === 10) tenthMark += " /";
      else tenthMark += ` ${formatRollMark(b)}`;
    }

    if (c !== undefined) {
      tenthMark += ` ${formatRollMark(c)}`;
    }

    score += tenthRolls.reduce((sum, roll) => sum + Number(roll ?? 0), 0);
    frames.push({ frame, mark: tenthMark, total: score });
  }

  return { total: score, frames };
}

function getFrameRollLimit(rolls) {
  let rollIndex = 0;

  for (let frame = 1; frame <= 9; frame++) {
    const first = rolls[rollIndex];
    if (first === undefined) return { frame, rollInFrame: 1, max: 10, canStrike: true };

    if (first === 10) {
      rollIndex += 1;
      continue;
    }

    const second = rolls[rollIndex + 1];
    if (second === undefined) return { frame, rollInFrame: 2, max: 10 - first, canStrike: false };

    rollIndex += 2;
  }

  const tenth = rolls.slice(rollIndex);

  if (tenth.length === 0) return { frame: 10, rollInFrame: 1, max: 10, canStrike: true };

  if (tenth.length === 1) {
    return {
      frame: 10,
      rollInFrame: 2,
      max: tenth[0] === 10 ? 10 : 10 - tenth[0],
      canStrike: tenth[0] === 10,
    };
  }

  if (tenth.length === 2) {
    const [a, b] = tenth;
    if (a === 10 || a + b === 10) {
      return { frame: 10, rollInFrame: 3, max: 10, canStrike: true };
    }
    return null;
  }

  return null;
}

function formatPinButton(pins, next) {
  if (!next) return String(pins);
  if (pins === 10 && next.canStrike) return "X";
  if (pins === 0) return "-";
  return String(pins);
}

function formatRolls(rolls) {
  return rolls.map((roll) => formatRollMark(roll)).join(" · ");
}

const keypadNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 10];

export default function App() {
  const [playerName, setPlayerName] = useState("나");
  const [place, setPlace] = useState("");
  const [rolls, setRolls] = useState([]);
  const [records, setRecords] = useState([]);
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const result = useMemo(() => calcBowlingScore(rolls), [rolls]);
  const next = getFrameRollLimit(rolls);

  useEffect(() => {
    let channel;
    let mounted = true;

    async function init() {
      const client = await getSupabaseClient();
      if (!client) {
        setIsRealtimeReady(false);
        return;
      }

      const { data, error } = await client
        .from("bowling_games")
        .select("id, player_name, place, total, rolls, frames, created_at")
        .order("created_at", { ascending: false })
        .limit(50);

      if (!mounted) return;
      if (!error && data) setRecords(data);

      channel = client
        .channel("bowling-games-realtime")
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bowling_games" },
          async () => {
            const { data: latest } = await client
              .from("bowling_games")
              .select("id, player_name, place, total, rolls, frames, created_at")
              .order("created_at", { ascending: false })
              .limit(50);

            if (latest) setRecords(latest);
          }
        )
        .subscribe((status) => {
          setIsRealtimeReady(status === "SUBSCRIBED");
        });
    }

    init();

    return () => {
      mounted = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, []);

  const addRoll = (pins) => {
    if (!next || pins > next.max) return;
    setRolls((prev) => [...prev, pins]);
  };

  const undo = () => setRolls((prev) => prev.slice(0, -1));
  const reset = () => setRolls([]);

  const saveGame = async () => {
    if (rolls.length === 0 || isSaving) return;

    const client = await getSupabaseClient();
    if (!client) {
      alert(".env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해야 합니다.");
      return;
    }

    setIsSaving(true);

    const payload = {
      player_name: playerName || "나",
      place,
      total: result.total,
      rolls,
      frames: result.frames,
    };

    const { error } = await client.from("bowling_games").insert(payload);

    setIsSaving(false);

    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }

    setRolls([]);
  };

  const deleteRecord = async (id) => {
    const client = await getSupabaseClient();
    if (!client) return;

    const { error } = await client.from("bowling_games").delete().eq("id", id);
    if (error) alert(`삭제 실패: ${error.message}`);
  };

  return (
    <main className="app">
      <section className="container">
        <header className="header">
          <div>
            <h1>🎳 볼링 점수 기록</h1>
            <p>같은 주소로 접속한 사용자에게 저장 기록이 실시간 반영됩니다.</p>
          </div>
          <div className={isRealtimeReady ? "status live" : "status off"}>
            {isRealtimeReady ? "LIVE" : "OFF"}
          </div>
        </header>

        <section className="card">
          <div className="inputGrid">
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="이름" />
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="볼링장" />
          </div>

          <div className="scoreBox">
            <span>현재 점수</span>
            <strong>{result.total}</strong>
            <small>{next ? `${next.frame}프레임 ${next.rollInFrame}구 입력 중` : "게임 입력 완료"}</small>
            <em>{formatRolls(rolls)}</em>
          </div>

          <div className="frames">
            {Array.from({ length: 10 }, (_, i) => {
              const frame = result.frames[i];
              return (
                <div className="frame" key={i}>
                  <span>{i + 1}</span>
                  <strong>{frame?.mark || ""}</strong>
                  <small>{frame?.total || ""}</small>
                </div>
              );
            })}
          </div>

          <div className="pinGrid keypad">
            {keypadNumbers.map((pins) => (
              <button
                key={pins}
                disabled={!next || pins > next.max || (pins === 10 && !next.canStrike)}
                onClick={() => addRoll(pins)}
                className={pins === 10 && next?.canStrike ? "pin strike" : "pin"}
              >
                {formatPinButton(pins, next)}
              </button>
            ))}
          </div>

          <div className="buttonGrid">
            <button onClick={undo} disabled={rolls.length === 0}>되돌리기</button>
            <button onClick={reset} disabled={rolls.length === 0}>초기화</button>
            <button className="primary" onClick={saveGame} disabled={rolls.length === 0 || isSaving}>
              {isSaving ? "저장 중" : "저장"}
            </button>
          </div>
        </section>

        <section className="history">
          <h2>실시간 기록</h2>

          {records.length === 0 ? (
            <div className="empty">저장된 기록이 없습니다.</div>
          ) : (
            records.map((record) => (
              <article className="record" key={record.id}>
                <div>
                  <strong>{record.total}점</strong>
                  <p>{record.player_name} · {record.place || "장소 미입력"}</p>
                  <small>{new Date(record.created_at).toLocaleString()}</small>
                </div>
                <button onClick={() => deleteRecord(record.id)}>삭제</button>
              </article>
            ))
          )}
        </section>
      </section>
    </main>
  );
}
