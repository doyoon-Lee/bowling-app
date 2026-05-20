import React, { useEffect, useMemo, useRef, useState } from "react";
import { createWorker } from "tesseract.js";
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

    if (tenthComplete) {
      score += tenthRolls.reduce((sum, roll) => sum + Number(roll ?? 0), 0);
    }

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
      if (b === 10) return { frame: 10, rollInFrame: 3, max: 10, canStrike: true };
      return { frame: 10, rollInFrame: 3, max: 10 - b, canStrike: false };
    }

    if (a + b === 10) return { frame: 10, rollInFrame: 3, max: 10, canStrike: true };

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

  if (pins === 10 && next.rollInFrame === 2) {
    const currentFrameStart = getCurrentFrameStartIndex(rolls, next.frame);
    const firstRoll = rolls[currentFrameStart];
    if (firstRoll === 0) return "/";
  }

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

  if (parts.length === 1) return <span className="markPart single">{parts[0]}</span>;

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

function getDisplayUserName(user) {
  return (
    user?.email ||
    user?.user_metadata?.email ||
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.user_metadata?.nickname ||
    "로그인 사용자"
  );
}

function isInAppBrowser() {
  const ua = navigator.userAgent.toLowerCase();

  return (
    ua.includes("naver") ||
    ua.includes("kakaotalk") ||
    ua.includes("instagram") ||
    ua.includes("fbav") ||
    ua.includes("line")
  );
}

function openCurrentPageInExternalBrowser() {
  const currentUrl = window.location.href;
  const urlWithoutProtocol = currentUrl.replace(/^https?:\/\//, "");
  const ua = navigator.userAgent.toLowerCase();

  if (/android/i.test(ua)) {
    window.location.href = `intent://${urlWithoutProtocol}#Intent;scheme=https;package=com.android.chrome;end`;
    return;
  }

  window.location.href = currentUrl;
}

function normalizeOcrText(text) {
  return text
    .toUpperCase()
    .replace(/[×✕＊*]/g, "X")
    .replace(/[／]/g, "/")
    .replace(/[–—_]/g, "-")
    .replace(/O/g, "0")
    .replace(/I/g, "1")
    .replace(/S/g, "5")
    .replace(/[^0-9X/\-\s|]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseOcrTextToRolls(text) {
  const normalized = normalizeOcrText(text);
  const tokens = normalized.match(/10|[0-9]|X|\/|-/g) || [];
  const rolls = [];

  let frame = 1;
  let rollInFrame = 1;
  let firstRollInFrame = null;

  for (const token of tokens) {
    if (frame > 10) break;

    let value;

    if (token === "X") value = 10;
    else if (token === "-") value = 0;
    else if (token === "/") {
      if (firstRollInFrame === null) continue;
      value = Math.max(0, 10 - firstRollInFrame);
    } else {
      value = Number(token);
    }

    if (!Number.isInteger(value) || value < 0 || value > 10) continue;

    if (frame < 10) {
      if (rollInFrame === 1) {
        rolls.push(value);

        if (value === 10) {
          frame += 1;
          rollInFrame = 1;
          firstRollInFrame = null;
        } else {
          firstRollInFrame = value;
          rollInFrame = 2;
        }
      } else {
        if (firstRollInFrame !== null && firstRollInFrame + value > 10) continue;
        rolls.push(value);
        frame += 1;
        rollInFrame = 1;
        firstRollInFrame = null;
      }
    } else {
      const tenthStart = getCurrentFrameStartIndex(rolls, 10);
      const tenth = rolls.slice(tenthStart);

      if (tenth.length === 0) {
        rolls.push(value);
        firstRollInFrame = value;
        continue;
      }

      if (tenth.length === 1) {
        const first = tenth[0];
        if (first !== 10 && first + value > 10) continue;
        rolls.push(value);
        continue;
      }

      if (tenth.length === 2) {
        const [a, b] = tenth;
        const hasBonus = a === 10 || a + b === 10;
        if (!hasBonus) break;
        if (a === 10 && b !== 10 && b + value > 10) continue;
        rolls.push(value);
        break;
      }
    }
  }

  return rolls.slice(0, 21);
}

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [playerName, setPlayerName] = useState("");
  const [place, setPlace] = useState("");
  const [placeCandidates, setPlaceCandidates] = useState([]);
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeSearchMessage, setPlaceSearchMessage] = useState("");
  const [scoreImage, setScoreImage] = useState(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isAnalyzingScoreImage, setIsAnalyzingScoreImage] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const [rolls, setRolls] = useState([]);
  const [records, setRecords] = useState([]);
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

    const defaultName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.user_metadata?.nickname ||
      user.email?.split("@")[0] ||
      "";

    setPlayerName((prev) => prev || defaultName);
  }, [user]);

  useEffect(() => {
    let channel;
    let mounted = true;

    async function loadRecords() {
      const client = await getSupabaseClient();
      if (!client || !user) {
        setRecords([]);
        return;
      }

      const fetchMyRecords = async () => {
        const { data, error } = await client
          .from("bowling_games")
          .select("id, user_id, user_email, player_name, place, total, rolls, frames, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1000);

        if (!error && data && mounted) setRecords(data);
      };

      await fetchMyRecords();

      channel = client
        .channel(`bowling-games-${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bowling_games",
            filter: `user_id=eq.${user.id}`,
          },
          fetchMyRecords
        )
        .subscribe();
    }

    loadRecords();

    return () => {
      mounted = false;
      if (channel && supabase) supabase.removeChannel(channel);
    };
  }, [user]);

  const signInWithProvider = async (provider) => {
    if (isInAppBrowser() && provider === "google") {
      alert("네이버/카카오 앱 내부 브라우저에서는 Google 로그인이 차단될 수 있습니다. Chrome으로 이동합니다.");
      openCurrentPageInExternalBrowser();
      return;
    }

    const client = await getSupabaseClient();
    if (!client) {
      alert(".env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해야 합니다.");
      return;
    }

    const oauthOptions = { redirectTo: window.location.origin };

    if (provider === "kakao") {
      oauthOptions.queryParams = { prompt: "login" };
    }

    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: oauthOptions,
    });

    if (error) alert(`로그인 실패: ${error.message}`);
  };

  const signInWithGoogle = () => signInWithProvider("google");
  const signInWithKakao = () => signInWithProvider("kakao");

  const signOut = async () => {
    const client = await getSupabaseClient();
    if (!client) return;

    await client.auth.signOut();
    setRecords([]);
    setRolls([]);
    setPlayerName("");
  };

  const searchNearbyBowlingPlaces = () => {
    setIsPlaceModalOpen(true);
    setPlaceCandidates([]);
    setPlaceSearchMessage("");

    if (!navigator.geolocation) {
      setPlaceSearchMessage("이 브라우저에서는 위치 기능을 사용할 수 없습니다.");
      return;
    }

    if (!window.kakao || !window.kakao.maps) {
      setPlaceSearchMessage("Kakao Maps SDK가 로드되지 않았습니다. index.html의 JavaScript 키와 SDK 주소를 확인해주세요.");
      return;
    }

    setIsSearchingPlace(true);

    window.kakao.maps.load(() => {
      if (!window.kakao.maps.services) {
        setIsSearchingPlace(false);
        setPlaceSearchMessage("Kakao Maps services 라이브러리를 찾지 못했습니다. SDK 주소에 libraries=services가 포함되어 있는지 확인해주세요.");
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude } = position.coords;
          const places = new window.kakao.maps.services.Places();
          const location = new window.kakao.maps.LatLng(latitude, longitude);

          places.keywordSearch(
            "볼링장",
            (data, status) => {
              setIsSearchingPlace(false);

              if (status !== window.kakao.maps.services.Status.OK || !data?.length) {
                setPlaceSearchMessage("주변 볼링장을 찾지 못했습니다. 직접 입력해주세요.");
                return;
              }

              const candidates = data.slice(0, 3).map((item) => ({
                id: item.id,
                name: item.place_name,
                address: item.road_address_name || item.address_name,
                distance: item.distance ? `${Number(item.distance).toLocaleString()}m` : "거리 정보 없음",
              }));

              setPlaceCandidates(candidates);
            },
            {
              location,
              radius: 10000,
              sort: window.kakao.maps.services.SortBy.DISTANCE,
            }
          );
        },
        () => {
          setIsSearchingPlace(false);
          setPlaceSearchMessage("위치 권한이 필요합니다. 위치 허용 후 다시 눌러주세요.");
        },
        {
          enableHighAccuracy: true,
          timeout: 8000,
          maximumAge: 60000,
        }
      );
    });
  };

  const selectBowlingPlace = (candidate) => {
    setPlace(candidate.name);
    setIsPlaceModalOpen(false);
  };

  const handleScoreImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setScoreImage(file);
    setCameraMessage("");
    setIsCameraModalOpen(true);
  };

  const analyzeScoreImage = async () => {
    if (!scoreImage) {
      setCameraMessage("분석할 사진을 먼저 선택해주세요.");
      return;
    }

    setIsAnalyzingScoreImage(true);
    setCameraMessage("OCR 준비 중입니다. 처음 실행은 10~30초 정도 걸릴 수 있습니다.");

    let worker;

    try {
      worker = await createWorker("eng", 1, {
        logger: (message) => {
          if (message.status === "recognizing text") {
            const progress = Math.round((message.progress || 0) * 100);
            setCameraMessage(`점수판 글자를 읽는 중입니다... ${progress}%`);
          }
        },
      });

      await worker.setParameters({
        tessedit_char_whitelist: "0123456789Xx/-| ",
        preserve_interword_spaces: "1",
      });

      const { data } = await worker.recognize(scoreImage);
      const text = data?.text || "";

      console.log("Tesseract OCR Raw Text:", text);

      const parsedRolls = parseOcrTextToRolls(text);

      if (!parsedRolls.length) {
        setCameraMessage(`점수판을 인식하지 못했습니다. OCR 결과: ${normalizeOcrText(text) || "비어 있음"}`);
        return;
      }

      setRolls(parsedRolls);
      setIsCameraModalOpen(false);
      setScoreImage(null);
      setCameraMessage("");
    } catch (error) {
      console.error("Tesseract Analyze Error:", error);
      setCameraMessage(`OCR 분석 중 오류 발생: ${error?.message || "알 수 없는 오류"}`);
    } finally {
      if (worker) await worker.terminate();
      setIsAnalyzingScoreImage(false);
    }
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

    if (!user) {
      alert("로그인 후 저장할 수 있습니다.");
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
      user_email:
        user.email ||
        user.user_metadata?.email ||
        user.user_metadata?.kakao_account?.email ||
        `${user.id}@kakao.local`,
      player_name: playerName.trim(),
      place,
      total: result.total,
      rolls,
      frames: result.frames,
    };

    const { data: savedRecord, error } = await client
      .from("bowling_games")
      .insert(payload)
      .select("id, user_id, user_email, player_name, place, total, rolls, frames, created_at")
      .single();

    setIsSaving(false);

    if (error) {
      alert(`저장 실패: ${error.message}`);
      return;
    }

    if (savedRecord) {
      setRecords((prev) => {
        const alreadyExists = prev.some((record) => record.id === savedRecord.id);
        if (alreadyExists) return prev;
        return [savedRecord, ...prev];
      });
    }

    setRolls([]);
  };

  const deleteRecord = async (id) => {
    if (!window.confirm("이 기록을 삭제할까요?")) return;

    const client = await getSupabaseClient();
    if (!client || !user) return;

    const { error } = await client
      .from("bowling_games")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id);

    if (error) {
      alert(`삭제 실패: ${error.message}`);
      return;
    }

    setRecords((prev) => prev.filter((record) => record.id !== id));
  };

  if (authLoading) {
    return (
      <main className="app authPage">
        <section className="authContainer">
          <div className="loginCard loadingCard">
            <div className="logoBadge">🎳</div>
            <h1>Bowling Score</h1>
            <p>로그인 상태를 확인하는 중입니다...</p>
          </div>
        </section>
      </main>
    );
  }

  if (!session) {
    const inAppBrowser = isInAppBrowser();

    return (
      <main className="app authPage">
        <section className="authContainer">
          <div className="loginCard">
            <div className="logoBadge">🎳</div>
            <h1>Bowling Score</h1>
            <p className="loginSubtitle">개인 볼링 기록을 날짜별로 저장하고 점수 변화를 확인하세요.</p>

            <div className="loginFeatureGrid">
              <div>
                <strong>개인 기록</strong>
                <span>계정별 점수 저장</span>
              </div>
              <div>
                <strong>날짜별 관리</strong>
                <span>일자별 평균/최고점</span>
              </div>
            </div>

            {inAppBrowser && (
              <div className="browserNotice">
                <strong>외부 브라우저가 필요합니다.</strong>
                <span>네이버/카카오 앱 내부 브라우저에서는 Google 로그인이 차단될 수 있습니다. Kakao 로그인 또는 Chrome 열기를 사용하세요.</span>
              </div>
            )}

            <div className="loginButtonGroup">
              <button className="googleLoginButton" onClick={signInWithGoogle}>
                <span className="loginButtonInner">
                  <img src="https://www.gstatic.com/firebasejs/ui/2.0.0/images/auth/google.svg" alt="Google" />
                  <span>{inAppBrowser ? "Chrome으로 열기" : "Google 계정으로 로그인"}</span>
                </span>
              </button>

              <button className="kakaoLoginButton" onClick={signInWithKakao}>
                <span className="loginButtonInner">
                  <span className="kakaoLogoText">K</span>
                  <span>Kakao 계정으로 로그인</span>
                </span>
              </button>
            </div>
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
            <p>{getDisplayUserName(user)}</p>
          </div>
          <div className="headerActions">
            <button className="logoutButton" onClick={signOut}>로그아웃</button>
          </div>
        </header>

        <section className="scoreboardCard">
          <div className="playerBar">
            <input value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="이름을 적어주세요" />
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              onClick={searchNearbyBowlingPlaces}
              placeholder="볼링장 이름을 기입해주세요"
            />
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

          <div className="scoreInputHeader">
            <div className="keypadTitle">핀 수 입력</div>
            <label className="cameraButton">
              📷 점수판 촬영
              <input type="file" accept="image/*" capture="environment" onChange={handleScoreImageChange} />
            </label>
          </div>

          <div className="pinGrid keypad">
            {keypadNumbers
              .filter((pins) => {
                if (pins !== 10) return true;
                if (next?.canStrike) return true;

                if (next?.rollInFrame === 2) {
                  const currentFrameStart = getCurrentFrameStartIndex(rolls, next.frame);
                  return rolls[currentFrameStart] === 0;
                }

                return false;
              })
              .map((pins) => {
                const isGutterSpareButton = (() => {
                  if (!next || pins !== 10 || next.rollInFrame !== 2) return false;
                  const currentFrameStart = getCurrentFrameStartIndex(rolls, next.frame);
                  return rolls[currentFrameStart] === 0;
                })();

                return (
                  <button
                    key={pins}
                    disabled={!next || pins > next.max || (pins === 10 && !next.canStrike && !isGutterSpareButton)}
                    onClick={() => addRoll(pins)}
                    className={pins === 10 && (next?.canStrike || isGutterSpareButton) ? "pin strike" : "pin"}
                  >
                    {formatPinButton(pins, next, rolls)}
                  </button>
                );
              })}
          </div>

          <div className="buttonGrid">
            <button onClick={undo} disabled={rolls.length === 0}>되돌리기</button>
            <button onClick={reset} disabled={rolls.length === 0}>초기화</button>
            <button className="primary" onClick={saveGame} disabled={rolls.length === 0 || isSaving}>
              {isSaving ? "저장 중" : "저장"}
            </button>
          </div>
        </section>

        {isCameraModalOpen && (
          <div className="placeModalBackdrop" onClick={() => setIsCameraModalOpen(false)}>
            <div className="placeModal" onClick={(e) => e.stopPropagation()}>
              <div className="placeModalHeader">
                <div>
                  <strong>점수판 사진 분석</strong>
                  <span>볼링장 모니터를 정면으로 촬영해주세요.</span>
                </div>
                <button onClick={() => setIsCameraModalOpen(false)}>닫기</button>
              </div>

              {scoreImage && (
                <img className="scoreImagePreview" src={URL.createObjectURL(scoreImage)} alt="점수판 미리보기" />
              )}

              {cameraMessage && <div className="placeMessage">{cameraMessage}</div>}

              <button className="manualPlaceButton" onClick={analyzeScoreImage} disabled={isAnalyzingScoreImage}>
                {isAnalyzingScoreImage ? "분석 중..." : "사진으로 점수 입력"}
              </button>

              <p className="cameraGuide">
                현재 기능은 Tesseract.js OCR로 브라우저에서 직접 분석합니다. 인식이 부정확하면 사진을 더 정면에서 크게 찍어주세요.
              </p>
            </div>
          </div>
        )}

        {isPlaceModalOpen && (
          <div className="placeModalBackdrop" onClick={() => setIsPlaceModalOpen(false)}>
            <div className="placeModal" onClick={(e) => e.stopPropagation()}>
              <div className="placeModalHeader">
                <div>
                  <strong>주변 볼링장</strong>
                  <span>현재 위치 기준 최대 3개</span>
                </div>
                <button onClick={() => setIsPlaceModalOpen(false)}>닫기</button>
              </div>

              {isSearchingPlace && <div className="placeLoading">주변 볼링장을 검색 중입니다...</div>}
              {!isSearchingPlace && placeSearchMessage && <div className="placeMessage">{placeSearchMessage}</div>}

              {!isSearchingPlace && placeCandidates.length > 0 && (
                <div className="placeList">
                  {placeCandidates.map((candidate) => (
                    <button key={candidate.id} onClick={() => selectBowlingPlace(candidate)}>
                      <strong>{candidate.name}</strong>
                      <span>{candidate.distance}</span>
                      <em>{candidate.address}</em>
                    </button>
                  ))}
                </div>
              )}

              <button className="manualPlaceButton" onClick={() => setIsPlaceModalOpen(false)}>
                직접 입력하기
              </button>
            </div>
          </div>
        )}

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
                            deleteRecord(record.id);
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
      </section>
    </main>
  );
}
