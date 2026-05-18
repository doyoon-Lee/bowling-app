import React, { useEffect, useMemo, useRef, useState } from "react";
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

function formatFrameMark(first, second, third, frame) {
  if (first === undefined) return "";

  if (frame < 10) {
    if (first === 10) return "X";
    if (second === undefined) return `${formatRollMark(first)} |`;
    if (first + second === 10) return `${formatRollMark(first)} | /`;
    return `${formatRollMark(first)} | ${formatRollMark(second)}`;
  }

  const firstMark = formatRollMark(first);
  let secondMark = "";
  let thirdMark = "";

  if (second !== undefined) {
    if (first !== 10 && first + second === 10) secondMark = "/";
    else secondMark = formatRollMark(second);
  }

  if (third !== undefined) {
    if (first === 10 && second !== 10 && second + third === 10) thirdMark = "/";
    else thirdMark = formatRollMark(third);
  }

  return [firstMark, secondMark, thirdMark].filter(Boolean).join(" | ");
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
        const bonus1 = rolls[rollIndex + 1];
        const bonus2 = rolls[rollIndex + 2];
        const canCalculate = bonus1 !== undefined && bonus2 !== undefined;
        if (canCalculate) score += 10 + bonus1 + bonus2;
        frames.push({ frame, mark: "X", total: canCalculate ? score : "" });
        rollIndex += 1;
        continue;
      }

      if (second === undefined) {
        frames.push({ frame, mark: formatFrameMark(first, undefined, undefined, frame), total: "" });
        rollIndex += 2;
        continue;
      }

      if (first + second === 10) {
        const bonus = rolls[rollIndex + 2];
        const canCalculate = bonus !== undefined;
        if (canCalculate) score += 10 + bonus;
        frames.push({ frame, mark: formatFrameMark(first, second, undefined, frame), total: canCalculate ? score : "" });
      } else {
        score += first + second;
        frames.push({ frame, mark: formatFrameMark(first, second, undefined, frame), total: score });
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
    const tenthMark = formatFrameMark(a, b, c, frame);

    const tenthComplete = tenthRolls.length === 3 || (tenthRolls.length === 2 && a !== 10 && a + b < 10);
    if (tenthComplete) score += tenthRolls.reduce((sum, roll) => sum + Number(roll ?? 0), 0);

    frames.push({ frame, mark: tenthMark, total: tenthComplete ? score : "" });
  }

  const visibleTotal = [...frames].reverse().find((frame) => frame.total !== "")?.total || 0;
  return { total: visibleTotal, frames };
}

function calcMaxPossibleScore(rolls) {
  const next = getFrameRollLimit(rolls);
  if (!next) return calcBowlingScore(rolls).total;

  const simulated = [...rolls];
  let guard = 0;

  while (getFrameRollLimit(simulated) && guard < 25) {
    const limit = getFrameRollLimit(simulated);
    simulated.push(limit.max);
    guard += 1;
  }

  return calcBowlingScore(simulated).total;
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

    if (a === 10) {
      if (b === 10) {
        return { frame: 10, rollInFrame: 3, max: 10, canStrike: true };
      }

      return { frame: 10, rollInFrame: 3, max: 10 - b, canStrike: false };
    }

    if (a + b === 10) {
      return { frame: 10, rollInFrame: 3, max: 10, canStrike: true };
    }

    return null;
  }

  return null;
}

function getCurrentFrameStartIndex(rolls, frame) {
  let idx = 0;

  for (let f = 1; f < frame; f++) {
    if (rolls[idx] === 10 && f < 10) idx += 1;
    else idx += 2;
  }

  return idx;
}

function formatPinButton(pins, next, rolls) {
  if (!next) return String(pins);

  if (pins === 10 && next.canStrike) return "X";

  if (next.rollInFrame === 2) {
    const currentFrameStart = getCurrentFrameStartIndex(rolls, next.frame);
    const firstRoll = rolls[currentFrameStart];

    if (firstRoll !== undefined) {
      const spareValue = 10 - firstRoll;

      if (pins === spareValue) return "/";
      if (pins === 0) return "-";
    }
  }

  if (next.frame === 10 && next.rollInFrame === 3) {
    const currentFrameStart = getCurrentFrameStartIndex(rolls, 10);
    const firstRoll = rolls[currentFrameStart];
    const secondRoll = rolls[currentFrameStart + 1];

    if (firstRoll === 10 && secondRoll !== 10) {
      const spareValue = 10 - secondRoll;
      if (pins === spareValue) return "/";
    }
  }

  if (pins === 0) return "-";

  return String(pins);
}

const keypadNumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 0, 10];

function renderFrameMark(mark) {
  if (!mark) return <span className="markEmpty">&nbsp;</span>;

  const parts = String(mark)
    .split("|")
    .map((part) => part.trim())
    .filter((part) => part.length > 0);

  if (parts.length === 1) {
    return <span className="markPart single">{parts[0]}</span>;
  }

  return parts.map((part, index) => (
    <React.Fragment key={`${part}-${index}`}>
      <span className="markPart">{part}</span>
      {index < parts.length - 1 && <span className="markDivider">|</span>}
    </React.Fragment>
  ));
}

function displayTotal(total) {
  return total === "" || total === undefined || total === null ? " " : total;
}

function getKoreaDateKey(dateValue) {
  return new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(dateValue));
}

function getKoreaDateLabel(dateKey) {
  const [year, month, day] = dateKey.split("-");
  return `${year}.${month}.${day}`;
}

function groupRecordsByDate(records) {
  return records.reduce((groups, record) => {
    const dateKey = getKoreaDateKey(record.created_at);
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(record);
    return groups;
  }, {});
}

function getDayAverage(records) {
  if (!records.length) return 0;
  const total = records.reduce((sum, record) => sum + Number(record.total || 0), 0);
  return Math.round(total / records.length);
}

function getDayHigh(records) {
  if (!records.length) return 0;
  return Math.max(...records.map((record) => Number(record.total || 0)));
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [place, setPlace] = useState("");
  const [rolls, setRolls] = useState([]);
  const [records, setRecords] = useState([]);
  const [isRealtimeReady, setIsRealtimeReady] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const scoreboardRef = useRef(null);

  const user = session?.user;
  const result = useMemo(() => calcBowlingScore(rolls), [rolls]);
  const maxPossible = useMemo(() => calcMaxPossibleScore(rolls), [rolls]);
  const groupedRecords = useMemo(() => groupRecordsByDate(records), [records]);
  const sortedDateKeys = useMemo(() => Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a)), [groupedRecords]);
  const next = getFrameRollLimit(rolls);

  useEffect(() => {
    if (!scoreboardRef.current || !next) return;

    const targetFrameIndex = Math.max(0, next.frame - 1);
    const frameWidth = scoreboardRef.current.scrollWidth / 10;

    scoreboardRef.current.scrollTo({
      left: Math.max(0, frameWidth * targetFrameIndex - frameWidth),
      behavior: "smooth",
    });
  }, [rolls.length, next?.frame]);

  useEffect(() => {
    let mounted = true;
    let subscription;

    async function initAuth() {
      const client = await getSupabaseClient();
      if (!client) {
        setAuthLoading(false);
        return;
      }

      const { data } = await client.auth.getSession();
      if (!mounted) return;

      setSession(data.session);
      setAuthLoading(false);

      const authListener = client.auth.onAuthStateChange((_event, nextSession) => {
        setSession(nextSession);
      });

      subscription = authListener.data.subscription;
    }

    initAuth();

    return () => {
      mounted = false;
      if (subscription) subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!user) return;

    const defaultName = user.user_metadata?.full_name || user.email?.split("@")[0] || "";
    setPlayerName((prev) => prev || defaultName);
  }, [user]);

  useEffect(() => {
    let channel;
    let mounted = true;

    async function loadRecords() {
      const client = await getSupabaseClient();
      if (!client || !user) {
        setRecords([]);
        setIsRealtimeReady(false);
        return;
      }

      const fetchMyRecords = async () => {
        const { data, error } = await client
          .from("bowling_games")
          .select("id, user_id, user_email, player_name, place, total, rolls, frames, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(100);

        if (!error && data && mounted) setRecords(data);
      };

      await fetchMyRecords();

      channel = client
        .channel(`bowling-games-${user.id}`)
        .on(
          "postgres_changes",
          { event: "*", schema: "public", table: "bowling_games", filter: `user_id=eq.${user.id}` },
          fetchMyRecords
        )
        .subscribe((status) => {
          if (mounted) setIsRealtimeReady(status === "SUBSCRIBED");
        });
    }

    loadRecords();

    return () => {
      mounted = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [user]);

  const signInWithGoogle = async () => {
    const client = await getSupabaseClient();
    if (!client) {
      alert(".env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해야 합니다.");
      return;
    }

    const { error } = await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });

    if (error) alert(`구글 로그인 실패: ${error.message}`);
  };

  const signOut = async () => {
    const client = await getSupabaseClient();
    if (!client) return;

    await client.auth.signOut();
    setRecords([]);
    setRolls([]);
    setPlayerName("");
    setIsRealtimeReady(false);
  };

  const addRoll = (pins) => {
    if (!next || pins > next.max) return;
    setRolls((prev) => [...prev, pins]);
  };

  const undo = () => setRolls((prev) => prev.slice(0, -1));
  const reset = () => setRolls([]);

  const saveGame = async () => {
    if (rolls.length === 0 || isSaving) return;

    if (!playerName.trim()) {
      alert("이름을 넣어주세요.");
      return;
    }

    const client = await getSupabaseClient();
    if (!client) {
      alert(".env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해야 합니다.");
      return;
    }

    setIsSaving(true);

    const payload = {
      user_id: user.id,
      user_email: user.email,
      player_name: playerName.trim(),
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

    if (!user) return;

    const { error } = await client.from("bowling_games").delete().eq("id", id).eq("user_id", user.id);
    if (error) alert(`삭제 실패: ${error.message}`);
  };

  if (authLoading) {
    return (
      <main className="app">
        <section className="container">
          <div className="loginCard">로그인 상태를 확인하는 중입니다...</div>
        </section>
      </main>
    );
  }

  if (!session) {
    return (
      <main className="app">
        <section className="container">
          <div className="loginCard">
            <h1>🎳 Bowling Score</h1>
            <p>구글 계정으로 로그인하고 개인 볼링 기록을 저장하세요.</p>
            <button className="googleLoginButton" onClick={signInWithGoogle}>Google 계정으로 로그인</button>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="app">
      <section className="container">
        <header className="header compactHeader">
          <div>
            <h1>🎳 Bowling Score</h1>
            <p>{user?.email}</p>
          </div>
          <div className="headerActions">
            <div className={isRealtimeReady ? "status live" : "status off"}>{isRealtimeReady ? "LIVE" : "OFF"}</div>
            <button className="logoutButton" onClick={signOut}>로그아웃</button>
          </div>
        </header>

        <section className="scoreboardCard">
          <div className="playerBar">
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="이름을 적어주세요" />
            <input value={place} onChange={(e) => setPlace(e.target.value)} placeholder="볼링장 이름을 기입해주세요" />
          </div>

          <div className="summaryBoard">
            <div>
              <span>현재 점수</span>
              <strong>{result.total}</strong>
            </div>
            <div>
              <span>MAX</span>
              <strong>{maxPossible}</strong>
            </div>
            <div>
              <span>현재 입력</span>
              <strong className="smallScore">{next ? `${next.frame}F ${next.rollInFrame}구` : "완료"}</strong>
            </div>
          </div>
          <div className="laneScoreboard" ref={scoreboardRef}>
            {Array.from({ length: 10 }, (_, i) => {
              const frame = result.frames[i];
              return (
                <div className="frameBox" key={i}>
                  <div className="frameNo">{i + 1}</div>
                  <div className="frameMark">{renderFrameMark(frame?.mark)}</div>
                  <div className="frameTotal">{displayTotal(frame?.total)}</div>
                </div>
              );
            })}
          </div>

          <div className="keypadTitle">핀 수 입력</div>
          <div className="pinGrid keypad">
            {keypadNumbers.map((pins) => (
              <button
                key={pins}
                disabled={!next || pins > next.max || (pins === 10 && !next.canStrike)}
                onClick={() => addRoll(pins)}
                className={pins === 10 && next?.canStrike ? "pin strike" : "pin"}
              >
                {formatPinButton(pins, next, rolls)}
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
                        <button onClick={() => deleteRecord(record.id)}>삭제</button>
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
      </section>
    </main>
  );
}
