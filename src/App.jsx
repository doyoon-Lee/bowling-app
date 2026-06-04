import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import AuthScreen from "./components/AuthScreen";
import BeginnerKeypad from "./components/BeginnerKeypad";
import History from "./components/History";
import LiveRoom from "./components/LiveRoom";
import OCRModal from "./components/OCRModal";
import PlaceModal from "./components/PlaceModal";
import RoomLobby from "./components/RoomLobby";
import ProMode from "./components/ProMode";
import Scoreboard from "./components/Scoreboard";

import { APP_LOGGED_OUT_KEY, createGuestName, getDisplayUserName, isGuestUser, isInAppBrowser, openCurrentPageInExternalBrowser } from "./utils/auth";
import { calcBowlingScore, calcMaxPossibleScore, getFrameRollLimit, normalizeGeminiRollsFromFrames, repairTenthFrameRolls } from "./utils/bowling.jsx";
import {createRoom, findRoomByCode, joinRoomById, upsertRoomScore } from "./utils/room";
import { groupRecordsByDate } from "./utils/date";
import { getCachedSupabaseClient, getSupabaseClient } from "./utils/supabaseClient";

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [scoreMode, setScoreMode] = useState("beginner");
  const [appMode, setAppMode] = useState("solo");
  const [roomId, setRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [roomScores, setRoomScores] = useState([]);

  const [playerName, setPlayerName] = useState("");
  const [place, setPlace] = useState("");
  const [placeCandidates, setPlaceCandidates] = useState([]);
  const [isPlaceModalOpen, setIsPlaceModalOpen] = useState(false);
  const [isSearchingPlace, setIsSearchingPlace] = useState(false);
  const [placeSearchMessage, setPlaceSearchMessage] = useState("");

  const [scoreImage, setScoreImage] = useState(null);
  const [scoreImagePreviewUrl, setScoreImagePreviewUrl] = useState("");
  const [cropMode, setCropMode] = useState(false);
  const [cropBox, setCropBox] = useState(null);
  const [cropDrag, setCropDrag] = useState(null);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [isAnalyzingScoreImage, setIsAnalyzingScoreImage] = useState(false);
  const [cameraMessage, setCameraMessage] = useState("");
  const [ocrPreviewRolls, setOcrPreviewRolls] = useState([]);
  const [ocrRawText, setOcrRawText] = useState("");
  const [geminiPreviewFrames, setGeminiPreviewFrames] = useState([]);
  const [analysisAttempt, setAnalysisAttempt] = useState(0);

  const [rolls, setRolls] = useState([]);
  const [pinFrames, setPinFrames] = useState([]);
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
    return () => {
      if (scoreImagePreviewUrl) URL.revokeObjectURL(scoreImagePreviewUrl);
    };
  }, [scoreImagePreviewUrl]);

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

      const appLoggedOut = localStorage.getItem(APP_LOGGED_OUT_KEY) === "true";
      const currentUser = data.session?.user;

      if (appLoggedOut && isGuestUser(currentUser)) {
        setSession(null);
      } else {
        setSession(data.session);
      }

      setAuthLoading(false);

      const authListener = client.auth.onAuthStateChange((_event, nextSession) => {
        const appLoggedOut = localStorage.getItem(APP_LOGGED_OUT_KEY) === "true";
        const nextUser = nextSession?.user;

        if (appLoggedOut && isGuestUser(nextUser)) {
          setSession(null);
          return;
        }

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
      user.user_metadata?.guest_name ||
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
      const cached = getCachedSupabaseClient();
      if (channel && cached) cached.removeChannel(channel);
    };
  }, [user]);

  useEffect(() => {
    if (!roomId) {
      setRoomPlayers([]);
      setRoomScores([]);
      return;
    }

    let channel;
    let mounted = true;

    async function subscribeRoom() {
      const client = await getSupabaseClient();
      if (!client) return;

      const fetchRoomData = async () => {
        const { data: players } = await client
          .from("bowling_room_players")
          .select("*")
          .eq("room_id", roomId)
          .order("created_at", { ascending: true });

        const { data: scores } = await client
          .from("bowling_room_scores")
          .select("*")
          .eq("room_id", roomId)
          .order("updated_at", { ascending: false });

        if (!mounted) return;
        setRoomPlayers(players || []);
        setRoomScores(scores || []);
      };

      await fetchRoomData();

      channel = client
        .channel(`room-${roomId}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bowling_room_players",
            filter: `room_id=eq.${roomId}`,
          },
          fetchRoomData
        )
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "bowling_room_scores",
            filter: `room_id=eq.${roomId}`,
          },
          fetchRoomData
        )
        .subscribe();
    }

    subscribeRoom();

    return () => {
      mounted = false;
      const cached = getCachedSupabaseClient();
      if (channel && cached) cached.removeChannel(channel);
    };
  }, [roomId]);

  const signInWithProvider = async (provider) => {
    localStorage.removeItem(APP_LOGGED_OUT_KEY);

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

  const signInAsGuest = async () => {
    const client = await getSupabaseClient();
    if (!client) {
      alert(".env 파일에 VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY를 설정해야 합니다.");
      return;
    }

    localStorage.removeItem(APP_LOGGED_OUT_KEY);

    const { data: sessionData } = await client.auth.getSession();
    const existingSession = sessionData?.session;

    if (existingSession?.user && isGuestUser(existingSession.user)) {
      setSession(existingSession);
      return;
    }

    const guestName = createGuestName();

    const { error } = await client.auth.signInAnonymously({
      options: { data: { guest_name: guestName } },
    });

    if (error) alert(`게스트 로그인 실패: ${error.message}`);
  };

  const signOut = async () => {
    const client = await getSupabaseClient();
    if (!client) return;

    if (isGuestUser(user)) {
      localStorage.setItem(APP_LOGGED_OUT_KEY, "true");
      setSession(null);
      setRecords([]);
      setRolls([]);
      setPinFrames([]);
      setPlayerName("");
      return;
    }

    localStorage.removeItem(APP_LOGGED_OUT_KEY);
    await client.auth.signOut();
    setRecords([]);
    setRolls([]);
    setPinFrames([]);
    setPlayerName("");
  };

  const handleCreateRoom = async (roomNameInput) => {
    const client = await getSupabaseClient();
    if (!client || !user) return;

    try {
      const room = await createRoom(client, {
        roomName: roomNameInput,
        ownerId: user.id,
        playerName: playerName || getDisplayUserName(user),
      });

      setRoomId(room.id);
      setRoomCode(room.room_code);
      setAppMode("room");
    } catch (error) {
      alert(`방 만들기 실패: ${error.message}`);
    }
  };

  const handleJoinRoom = async (joinCodeInput) => {
    const client = await getSupabaseClient();
    if (!client || !user) return;

    if (joinCodeInput.trim().replace(/\D/g, "").length !== 6) {
      alert("6자리 방 코드를 입력해주세요.");
      return;
    }

    try {
      const room = await findRoomByCode(client, joinCodeInput);
      await joinRoomById(client, {
        roomId: room.id,
        userId: user.id,
        playerName: playerName || getDisplayUserName(user),
      });

      setRoomId(room.id);
      setRoomCode(room.room_code);
      setAppMode("room");
    } catch (error) {
      alert(`방 참여 실패: ${error.message}`);
    }
  };

  const handleLeaveRoom = () => {
    setAppMode("solo");
    setRoomId(null);
    setRoomCode("");
    setRoomPlayers([]);
    setRoomScores([]);
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


  const getImagePointerPosition = (event) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const point = event.touches?.[0] || event.changedTouches?.[0] || event;
    return {
      x: Math.max(0, Math.min(1, (point.clientX - rect.left) / rect.width)),
      y: Math.max(0, Math.min(1, (point.clientY - rect.top) / rect.height)),
    };
  };

  const normalizeCropBox = (start, end) => {
    if (!start || !end) return null;
    const x = Math.min(start.x, end.x);
    const y = Math.min(start.y, end.y);
    const width = Math.abs(start.x - end.x);
    const height = Math.abs(start.y - end.y);
    if (width < 0.03 || height < 0.03) return null;
    return { x, y, width, height };
  };

  const startCropSelection = (event) => {
    if (!cropMode) return;
    event.preventDefault();
    const position = getImagePointerPosition(event);
    setCropDrag({ start: position, current: position });
    setCropBox(null);
  };

  const moveCropSelection = (event) => {
    if (!cropMode || !cropDrag) return;
    event.preventDefault();
    const position = getImagePointerPosition(event);
    setCropDrag((prev) => ({ ...prev, current: position }));
  };

  const endCropSelection = (event) => {
    if (!cropMode || !cropDrag) return;
    event.preventDefault();
    const position = getImagePointerPosition(event);
    const nextBox = normalizeCropBox(cropDrag.start, position);
    if (nextBox) setCropBox(nextBox);
    setCropDrag(null);
  };

  const setQuickCrop = (position) => {
    const presets = {
      top: { x: 0.04, y: 0.05, width: 0.92, height: 0.3 },
      middle: { x: 0.04, y: 0.35, width: 0.92, height: 0.3 },
      bottom: { x: 0.04, y: 0.65, width: 0.92, height: 0.3 },
    };
    setCropMode(true);
    setCropDrag(null);
    setCropBox(presets[position]);
  };

  const resetCropSelection = () => {
    setCropBox(null);
    setCropDrag(null);
    setCropMode(false);
  };

  const createCroppedScoreImageFile = async () => {
    if (!scoreImage || !cropBox) return scoreImage;

    const imageUrl = URL.createObjectURL(scoreImage);
    try {
      const image = await new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = imageUrl;
      });

      const sourceX = Math.round(image.naturalWidth * cropBox.x);
      const sourceY = Math.round(image.naturalHeight * cropBox.y);
      const sourceWidth = Math.round(image.naturalWidth * cropBox.width);
      const sourceHeight = Math.round(image.naturalHeight * cropBox.height);

      const canvas = document.createElement("canvas");
      canvas.width = sourceWidth;
      canvas.height = sourceHeight;

      canvas.getContext("2d").drawImage(
        image,
        sourceX,
        sourceY,
        sourceWidth,
        sourceHeight,
        0,
        0,
        sourceWidth,
        sourceHeight
      );

      const blob = await new Promise((resolve) => {
        canvas.toBlob((nextBlob) => resolve(nextBlob), "image/jpeg", 0.95);
      });

      if (!blob) return scoreImage;
      return new File([blob], `cropped-${scoreImage.name || "score.jpg"}`, { type: "image/jpeg" });
    } finally {
      URL.revokeObjectURL(imageUrl);
    }
  };

  const currentCropBox = cropDrag ? normalizeCropBox(cropDrag.start, cropDrag.current) : cropBox;

  const handleScoreImageChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (scoreImagePreviewUrl) URL.revokeObjectURL(scoreImagePreviewUrl);

    setScoreImage(file);
    setScoreImagePreviewUrl(URL.createObjectURL(file));
    setCropMode(false);
    setCropBox(null);
    setCropDrag(null);
    setCameraMessage("");
    setOcrPreviewRolls([]);
    setOcrRawText("");
    setGeminiPreviewFrames([]);
    setAnalysisAttempt(0);
    setIsCameraModalOpen(true);
  };

  const analyzeScoreImage = async () => {
    if (!scoreImage) {
      setCameraMessage("분석할 사진을 먼저 선택해주세요.");
      return;
    }

    const url = import.meta.env.VITE_SUPABASE_URL;
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      setCameraMessage("Supabase URL 또는 ANON KEY가 설정되지 않았습니다.");
      return;
    }

    setIsAnalyzingScoreImage(true);
    setCameraMessage("Gemini가 점수판 사진을 분석 중입니다...");

    try {
      const formData = new FormData();
      const imageForAnalysis = await createCroppedScoreImageFile();
      formData.append("image", imageForAnalysis);
      formData.append("is_cropped_score_row", cropBox ? "true" : "false");

      if (ocrPreviewRolls.length > 0 || geminiPreviewFrames.length > 0) {
        formData.append(
          "previous_result_json",
          JSON.stringify({
            rolls: ocrPreviewRolls,
            frames: geminiPreviewFrames,
            note: "사용자가 기존 분석 결과가 실제 사진과 다르다고 판단하여 재분석을 요청했습니다. 이전 결과를 그대로 반복하지 말고 사진을 다시 검토하세요.",
          })
        );
      }

      formData.append("retry_attempt", String(analysisAttempt + 1));

      const response = await fetch(`${url}/functions/v1/parse-bowling-score`, {
        method: "POST",
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${session?.access_token || anonKey}`,
        },
        body: formData,
      });

      const responseText = await response.text();
      console.log("Gemini Edge Function Status:", response.status);
      console.log("Gemini Edge Function Response:", responseText);

      let data = null;

      try {
        data = responseText ? JSON.parse(responseText) : null;
      } catch {
        setCameraMessage(`사진 분석 응답 파싱 실패: ${responseText}`);
        return;
      }

      if (!response.ok) {
        if (response.status === 503) {
          setCameraMessage("Gemini 서버 사용량이 많습니다. 잠시 후 다시 시도해주세요.");
          return;
        }

        if (response.status === 429) {
          setCameraMessage("AI 사용량 제한에 도달했습니다. 잠시 후 다시 시도해주세요.");
          return;
        }

        setCameraMessage(
          `사진 분석 오류 (${response.status}): ${data?.error || "알 수 없는 오류"}${data?.detail ? ` / ${data.detail}` : ""}`
        );
        return;
      }

      if (!data || !Array.isArray(data.rolls)) {
        setCameraMessage(`Gemini 응답 형식이 올바르지 않습니다: ${JSON.stringify(data)}`);
        return;
      }

      if (data.rolls.length === 0) {
        setCameraMessage(data.notes || "점수판을 인식하지 못했습니다. 사진을 더 정면에서 다시 찍어주세요.");
        return;
      }

      const frameBasedRolls = normalizeGeminiRollsFromFrames(data.frames, data.rolls);
      const repairedRolls = repairTenthFrameRolls(
        frameBasedRolls,
        data.frames,
        data.finalScore,
        data.cumulativeScores
      );
      const previewFrames = Array.isArray(data.frames) && data.frames.length > 0
        ? data.frames
        : calcBowlingScore(repairedRolls).frames;

      setOcrPreviewRolls(repairedRolls);
      setGeminiPreviewFrames(previewFrames);
      setOcrRawText(data.notes || `confidence: ${data.confidence ?? "정보 없음"}`);
      setAnalysisAttempt((prev) => prev + 1);
      setCameraMessage("Gemini 분석 결과를 확인한 뒤 맞으면 적용해주세요.");
    } catch (error) {
      console.error("Gemini Analyze Error:", error);
      setCameraMessage(`사진 분석 중 오류 발생: ${error?.message || "알 수 없는 오류"}`);
    } finally {
      setIsAnalyzingScoreImage(false);
    }
  };

  const applyOcrPreview = () => {
    if (!ocrPreviewRolls.length) return;

    setRolls(ocrPreviewRolls);
    setIsCameraModalOpen(false);
    if (scoreImagePreviewUrl) URL.revokeObjectURL(scoreImagePreviewUrl);

    setScoreImage(null);
    setScoreImagePreviewUrl("");
    setCropMode(false);
    setCropBox(null);
    setCropDrag(null);
    setCameraMessage("");
    setOcrPreviewRolls([]);
    setOcrRawText("");
    setGeminiPreviewFrames([]);
    setAnalysisAttempt(0);
  };


  const syncRoomScoreLive = async (nextRolls) => {
    if (appMode !== "room" || !roomId || !user) return;

    const client = await getSupabaseClient();
    if (!client) return;

    const nextResult = calcBowlingScore(nextRolls);
    const optimisticScore = {
      room_id: roomId,
      user_id: user.id,
      player_name: playerName.trim() || getDisplayUserName(user),
      total: nextResult.total,
      rolls: nextRolls,
      frames: nextResult.frames,
      updated_at: new Date().toISOString(),
    };

    setRoomScores((prev) => {
      const others = prev.filter((score) => score.user_id !== user.id);
      return [optimisticScore, ...others];
    });

    await client.from("bowling_room_scores").upsert(optimisticScore, {
      onConflict: "room_id,user_id",
    });
  };

  useEffect(() => {
    if (appMode !== "room" || !roomId || !user) return;
    syncRoomScoreLive(rolls);
  }, [rolls, appMode, roomId, user?.id]);

  const addRoll = (pins) => {
    if (!next || pins > next.max) return;
    setRolls((prev) => [...prev, pins]);
  };

  const undo = () => {
    setRolls((prev) => prev.slice(0, -1));
  };

  const reset = () => {
    setRolls([]);
    setPinFrames([]);
  };

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
    setPinFrames([]);
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

  if (authLoading || !session) {
    return (
      <AuthScreen
        authLoading={authLoading}
        inAppBrowser={isInAppBrowser()}
        onGoogleLogin={signInWithGoogle}
        onKakaoLogin={signInWithKakao}
        onGuestLogin={signInAsGuest}
      />
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
            <button className="logoutButton" onClick={signOut}>
              {isGuestUser(user) ? "게스트 초기화" : "로그아웃"}
            </button>
          </div>
        </header>

        <RoomLobby
          appMode={appMode}
          roomCode={roomCode}
          onCreateRoom={handleCreateRoom}
          onJoinRoom={handleJoinRoom}
          onLeaveRoom={handleLeaveRoom}
        />

        <section className="scoreboardCard">
          <div className="modeSwitch">
            <button
              type="button"
              className={scoreMode === "beginner" ? "active" : ""}
              onClick={() => setScoreMode("beginner")}
            >
              볼린이 모드
            </button>
            <button
              type="button"
              className={scoreMode === "pro" ? "active" : ""}
              onClick={() => setScoreMode("pro")}
            >
              Pro 모드
            </button>
          </div>

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
          </div>

          <Scoreboard result={result} scoreboardRef={scoreboardRef} />

          {scoreMode === "beginner" ? (
            <BeginnerKeypad
              next={next}
              rolls={rolls}
              onAddRoll={addRoll}
              onCameraChange={handleScoreImageChange}
            />
          ) : (
            <ProMode
              next={next}
              onAddRoll={addRoll}
              pinFrames={pinFrames}
              setPinFrames={setPinFrames}
            />
          )}

          <div className="buttonGrid">
            <button onClick={undo} disabled={rolls.length === 0}>되돌리기</button>
            <button onClick={reset} disabled={rolls.length === 0}>초기화</button>
            <button className="primary" onClick={saveGame} disabled={rolls.length === 0 || isSaving}>
              {isSaving ? "저장 중" : "저장"}
            </button>
          </div>
        </section>

        {isCameraModalOpen && (
          <OCRModal
            scoreImage={scoreImage}
            scoreImagePreviewUrl={scoreImagePreviewUrl}
            cropMode={cropMode}
            cropBox={cropBox}
            currentCropBox={currentCropBox}
            setCropMode={setCropMode}
            setQuickCrop={setQuickCrop}
            resetCropSelection={resetCropSelection}
            startCropSelection={startCropSelection}
            moveCropSelection={moveCropSelection}
            endCropSelection={endCropSelection}
            cameraMessage={cameraMessage}
            ocrPreviewRolls={ocrPreviewRolls}
            geminiPreviewFrames={geminiPreviewFrames}
            isAnalyzingScoreImage={isAnalyzingScoreImage}
            onClose={() => setIsCameraModalOpen(false)}
            onAnalyze={analyzeScoreImage}
            onApply={applyOcrPreview}
          />
        )}

        {isPlaceModalOpen && (
          <PlaceModal
            isSearchingPlace={isSearchingPlace}
            placeSearchMessage={placeSearchMessage}
            placeCandidates={placeCandidates}
            onSelect={selectBowlingPlace}
            onClose={() => setIsPlaceModalOpen(false)}
          />
        )}

        {appMode === "room" && (
          <LiveRoom
            roomPlayers={roomPlayers}
            roomScores={roomScores}
            currentUserId={user.id}
          />
        )}

        {appMode !== "room" && (
          <History
            sortedDateKeys={sortedDateKeys}
            groupedRecords={groupedRecords}
            onDeleteRecord={deleteRecord}
          />
        )}
      </section>
    </main>
  );
}
