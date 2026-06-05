import React, { useEffect, useMemo, useRef, useState } from "react";
import "./App.css";

import {
  calcBowlingScore,
  calcMaxPossibleScore,
  getFrameRollLimit,
  parseGeminiFrameRolls,
  normalizeGeminiRollsFromFrames,
  repairTenthFrameRolls,
  getCumulativeScoresFromData,
  repairGeminiFramesByCumulativeScores,
} from "./utils/bowling";

import AuthScreen from "./components/AuthScreen";
import BeginnerKeypad from "./components/BeginnerKeypad";
import History from "./components/History";
import LiveRoom from "./components/LiveRoom";
import OCRModal from "./components/OCRModal";
import PlaceModal from "./components/PlaceModal";
import RoomLobby from "./components/RoomLobby";
import ProMode from "./components/ProMode";
import Scoreboard from "./components/Scoreboard";

import { APP_LOGGED_OUT_KEY, createGuestName, getDisplayUserName, getUserEmail, isEmailLikeDisplayName, isGuestUser, isInAppBrowser, openCurrentPageInExternalBrowser } from "./utils/auth";
import { createRoom, findRoomByCode, findRoomById, joinRoomById, upsertRoomScore } from "./utils/room";
import { createBetRule } from "./utils/betting";
import { groupRecordsByDate } from "./utils/date";
import { getCachedSupabaseClient, getSupabaseClient } from "./utils/supabaseClient";

const BOWLING_RECORD_CACHE_PREFIX = "bowling_records_cache_v1";
const LIVE_ROOM_CACHE_PREFIX = "bowling_live_room_v1";
const LIVE_ROOM_DRAFT_PREFIX = "bowling_live_score_draft_v1";


const getRecordCacheKey = (userId) => `${BOWLING_RECORD_CACHE_PREFIX}:${userId || "anonymous"}`;
const getLiveRoomCacheKey = (userId) => `${LIVE_ROOM_CACHE_PREFIX}:${userId || "anonymous"}`;
const getLiveRoomDraftKey = (roomId, userId) => `${LIVE_ROOM_DRAFT_PREFIX}:${roomId || "no-room"}:${userId || "anonymous"}`;

const getPlayerNameForRoom = (playerName, user) => playerName?.trim() || getDisplayUserName(user);

const saveLiveRoomDraft = ({ roomId, userId, rolls, pinFrames }) => {
  if (!roomId || !userId) return;

  try {
    localStorage.setItem(
      getLiveRoomDraftKey(roomId, userId),
      JSON.stringify({
        rolls: Array.isArray(rolls) ? rolls : [],
        pinFrames: Array.isArray(pinFrames) ? pinFrames : [],
        savedAt: new Date().toISOString(),
      })
    );
  } catch (error) {
    console.warn("Failed to save live room draft:", error);
  }
};

const readLiveRoomDraft = (roomId, userId) => {
  if (!roomId || !userId) return null;

  try {
    const draft = JSON.parse(localStorage.getItem(getLiveRoomDraftKey(roomId, userId)) || "null");
    if (!draft || !Array.isArray(draft.rolls)) return null;
    return draft;
  } catch (error) {
    console.warn("Failed to read live room draft:", error);
    return null;
  }
};


const mergeRecordsById = (...recordGroups) => {
  const map = new Map();

  recordGroups
    .flat()
    .filter(Boolean)
    .forEach((record) => {
      if (!record?.id) return;
      map.set(record.id, record);
    });

  return Array.from(map.values()).sort((a, b) => {
    const aTime = new Date(a.created_at || 0).getTime();
    const bTime = new Date(b.created_at || 0).getTime();
    return bTime - aTime;
  });
};

export default function App() {
  const [session, setSession] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [scoreMode, setScoreMode] = useState("beginner");
  const [appMode, setAppMode] = useState("solo");
  const [roomId, setRoomId] = useState(null);
  const [roomCode, setRoomCode] = useState("");
  const [roomPlayers, setRoomPlayers] = useState([]);
  const [roomScores, setRoomScores] = useState([]);
  const [roomBetAmount, setRoomBetAmount] = useState(0);
  const [roomBetRule, setRoomBetRule] = useState(null);
  const roomChannelRef = useRef(null);
  const liveRoomReadyRef = useRef(false);

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
  const [liveSyncStatus, setLiveSyncStatus] = useState("");

  const scoreboardRef = useRef(null);
  const user = session?.user;

  useEffect(() => {
    if (!user) return;

    const displayName = getDisplayUserName(user);

    setPlayerName((currentName) => {
      if (!currentName.trim()) return displayName;
      if (isEmailLikeDisplayName(currentName, user)) return displayName;
      return currentName;
    });
  }, [user?.id, user?.email]);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;

    async function restoreLiveRoom() {
      let cachedRoom = null;

      try {
        cachedRoom = JSON.parse(localStorage.getItem(getLiveRoomCacheKey(user.id)) || "null");
      } catch (error) {
        console.warn("Failed to read cached live room:", error);
      }

      if (!cachedRoom?.roomId) return;

      const client = await getSupabaseClient();
      if (!client || !mounted) return;

      try {
        const room = await findRoomById(client, cachedRoom.roomId);
        if (!room || !mounted) return;

        await joinRoomById(client, {
          roomId: room.id,
          userId: user.id,
          playerName: getPlayerNameForRoom(playerName, user),
        });

        setRoomId(room.id);
        setRoomCode(room.room_code || cachedRoom.roomCode || "");
        setRoomBetAmount(Number(room.bet_amount || cachedRoom.betAmount || 0));
        setRoomBetRule(room.bet_rule || cachedRoom.betRule || createBetRule({ mode: "none" }));
        setRoomBetAmount(Number(room.bet_amount || cachedRoom.betAmount || 0));
        setAppMode("room");
      } catch (error) {
        console.warn("Cached live room restore failed:", error);
        localStorage.removeItem(getLiveRoomCacheKey(user.id));
      }
    }

    restoreLiveRoom();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    let mounted = true;
    const cacheKey = getRecordCacheKey(user.id);

    try {
      const cachedRecords = JSON.parse(localStorage.getItem(cacheKey) || "[]");
      if (Array.isArray(cachedRecords) && cachedRecords.length > 0) {
        setRecords((prev) => mergeRecordsById(prev, cachedRecords));
      }
    } catch (error) {
      console.warn("Failed to load cached bowling records:", error);
    }

    async function loadRecords() {
      const client = await getSupabaseClient();
      if (!client) return;

      const { data, error } = await client
        .from("bowling_games")
        .select("id, user_id, user_email, player_name, place, total, rolls, frames, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (!mounted) return;

      if (error) {
        console.error("Record load error:", error);
        return;
      }

      setRecords((prev) => mergeRecordsById(data || [], prev));
    }

    loadRecords();

    return () => {
      mounted = false;
    };
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id) return;

    try {
      localStorage.setItem(getRecordCacheKey(user.id), JSON.stringify(records));
    } catch (error) {
      console.warn("Failed to cache bowling records:", error);
    }
  }, [records, user?.id]);


  useEffect(() => {
    let mounted = true;
    let authSubscription = null;

    const initAuth = async () => {
      try {
        const client = await getSupabaseClient();

        if (!client) {
          if (mounted) {
            setSession(null);
            setAuthLoading(false);
          }
          return;
        }

        const { data } = await client.auth.getSession();

        if (mounted) {
          setSession(data?.session || null);
          setAuthLoading(false);
        }

        const { data: listener } = client.auth.onAuthStateChange((_event, nextSession) => {
          if (!mounted) return;

          setSession(nextSession || null);
          setAuthLoading(false);
        });

        authSubscription = listener?.subscription || null;
      } catch (error) {
        console.error("Auth init error:", error);

        if (mounted) {
          setSession(null);
          setAuthLoading(false);
        }
      }
    };

    initAuth();

    return () => {
      mounted = false;
      authSubscription?.unsubscribe?.();
    };
  }, []);


  const result = useMemo(() => calcBowlingScore(rolls), [rolls]);
  const maxPossible = useMemo(() => calcMaxPossibleScore(rolls), [rolls]);
  const groupedRecords = useMemo(() => groupRecordsByDate(records), [records]);
  const sortedDateKeys = useMemo(() => Object.keys(groupedRecords).sort((a, b) => b.localeCompare(a)), [groupedRecords]);
  const next = getFrameRollLimit(rolls);


  useEffect(() => {
    liveRoomReadyRef.current = false;

    if (!roomId) {
      setRoomPlayers([]);
      setRoomScores([]);
      return;
    }

    let channel;
    let pollingTimer;
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

      pollingTimer = window.setInterval(fetchRoomData, 3000);

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

      roomChannelRef.current = channel;
    }

    subscribeRoom();

    return () => {
      mounted = false;
      const cached = getCachedSupabaseClient();
      if (channel && cached) cached.removeChannel(channel);
      if (typeof pollingTimer !== "undefined") window.clearInterval(pollingTimer);
    };
  }, [roomId]);

  useEffect(() => {
    if (appMode !== "room" || !roomId || !user?.id) return;

    let mounted = true;

    async function restoreLiveRoomScore() {
      try {
        const draft = readLiveRoomDraft(roomId, user.id);

        if (draft?.rolls?.length) {
          setRolls(draft.rolls);
          setPinFrames(Array.isArray(draft.pinFrames) ? draft.pinFrames : []);
          return;
        }

        const client = await getSupabaseClient();
        if (!client || !mounted) return;

        const { data, error } = await client
          .from("bowling_room_scores")
          .select("rolls, frames")
          .eq("room_id", roomId)
          .eq("user_id", user.id)
          .maybeSingle();

        if (!mounted || error || !data) return;

        if (Array.isArray(data.rolls) && data.rolls.length) {
          setRolls(data.rolls);
        }
      } finally {
        if (mounted) liveRoomReadyRef.current = true;
      }
    }

    restoreLiveRoomScore();

    return () => {
      mounted = false;
    };
  }, [appMode, roomId, user?.id]);

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

    if (user?.id) {
      localStorage.removeItem(getLiveRoomCacheKey(user.id));
      if (roomId) localStorage.removeItem(getLiveRoomDraftKey(roomId, user.id));
    }

    if (isGuestUser(user)) {
      localStorage.setItem(APP_LOGGED_OUT_KEY, "true");
      setSession(null);
      setRolls([]);
      setPinFrames([]);
      setPlayerName("");
      return;
    }

    localStorage.removeItem(APP_LOGGED_OUT_KEY);
    await client.auth.signOut();
    setRolls([]);
    setPinFrames([]);
    setPlayerName("");
  };

  const handleCreateRoom = async ({ betAmount = 0, betRule = null } = {}) => {
    const client = await getSupabaseClient();
    if (!client || !user) return;

    try {
      const roomPlayerName = getPlayerNameForRoom(playerName, user);
      const room = await createRoom(client, {
        ownerId: user.id,
        playerName: roomPlayerName,
        betAmount,
        betRule,
      });

      localStorage.setItem(
        getLiveRoomCacheKey(user.id),
        JSON.stringify({ roomId: room.id, roomCode: room.room_code, betAmount: Number(room.bet_amount || betAmount || 0), betRule: room.bet_rule || betRule })
      );

      setRoomPlayers([{ room_id: room.id, user_id: user.id, player_name: roomPlayerName }]);
      setRoomScores([]);
      setRoomId(room.id);
      setRoomCode(room.room_code);
      setRoomBetAmount(Number(room.bet_amount || betAmount || 0));
      setRoomBetRule(room.bet_rule || betRule || createBetRule({ mode: "none" }));
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
      const roomPlayerName = getPlayerNameForRoom(playerName, user);
      await joinRoomById(client, {
        roomId: room.id,
        userId: user.id,
        playerName: roomPlayerName,
      });

      localStorage.setItem(
        getLiveRoomCacheKey(user.id),
        JSON.stringify({ roomId: room.id, roomCode: room.room_code, betAmount: Number(room.bet_amount || 0), betRule: room.bet_rule || createBetRule({ mode: 'none' }) })
      );

      setRoomPlayers((prev) => {
        const others = prev.filter((player) => player.user_id !== user.id);
        return [...others, { room_id: room.id, user_id: user.id, player_name: roomPlayerName }];
      });
      setRoomId(room.id);
      setRoomCode(room.room_code);
      setRoomBetAmount(Number(room.bet_amount || 0));
      setRoomBetRule(room.bet_rule || createBetRule({ mode: "none" }));
      setAppMode("room");
    } catch (error) {
      alert(`방 참여 실패: ${error.message}`);
    }
  };

  const handleLeaveRoom = async () => {
    const client = getCachedSupabaseClient();

    if (client && roomChannelRef.current) {
      await client.removeChannel(roomChannelRef.current);
      roomChannelRef.current = null;
    }

    if (user?.id) {
      localStorage.removeItem(getLiveRoomCacheKey(user.id));
      if (roomId) localStorage.removeItem(getLiveRoomDraftKey(roomId, user.id));
    }

    setAppMode("solo");
    setRoomId(null);
    setRoomCode("");
    setRoomPlayers([]);
    setRoomScores([]);
    setRoomBetAmount(0);
    setRoomBetRule(null);
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

  const getCumulativeScoresFromData = (data) => {
    const fromData = Array.isArray(data?.cumulativeScores)
      ? data.cumulativeScores.map((score) => Number(score)).filter((score) => Number.isFinite(score))
      : [];

    if (fromData.length > 0) return fromData.slice(0, 10);

    const fromFrames = Array.isArray(data?.frames)
      ? data.frames
          .slice()
          .sort((a, b) => Number(a.frame || 0) - Number(b.frame || 0))
          .map((frame) => Number(frame.total ?? frame.score ?? frame.cumulativeScore))
          .filter((score) => Number.isFinite(score))
      : [];

    return fromFrames.slice(0, 10);
  };

  const repairGeminiFramesByCumulativeScores = (frames, fallbackRolls = [], cumulativeScores = []) => {
    if (!Array.isArray(frames) || frames.length === 0 || !Array.isArray(cumulativeScores) || cumulativeScores.length === 0) {
      return fallbackRolls;
    }

    const sortedFrames = frames.slice().sort((a, b) => Number(a.frame || 0) - Number(b.frame || 0));
    const originalGroups = sortedFrames.map((frame) => parseGeminiFrameRolls(frame));
    const targetScores = cumulativeScores.map((score) => Number(score));

    const buildRolls = (groups) => groups.flatMap((group) => group || []).slice(0, 21);

    const getCandidates = (frameNo, originalRolls = []) => {
      const candidates = [];
      const add = (rolls) => {
        const key = rolls.join(",");
        if (!candidates.some((candidate) => candidate.join(",") === key)) candidates.push(rolls);
      };

      const clean = originalRolls
        .map((roll) => Number(roll))
        .filter((roll) => Number.isInteger(roll) && roll >= 0 && roll <= 10);

      if (clean.length) add(clean);

      if (frameNo < 10) {
        add([10]);

        for (let first = 0; first <= 9; first++) add([first, 10 - first]);

        for (let first = 0; first <= 9; first++) {
          for (let second = 0; second <= 9 - first; second++) add([first, second]);
        }
      }

      return candidates;
    };

    const evaluate = (groups) => {
      const candidateRolls = buildRolls(groups);
      const scoreResult = calcBowlingScore(candidateRolls);
      let penalty = 0;

      for (let i = 0; i < Math.min(10, targetScores.length); i++) {
        const target = targetScores[i];
        if (!Number.isFinite(target)) continue;

        const actual = Number(scoreResult.frames[i]?.total);
        penalty += Number.isFinite(actual) ? Math.abs(actual - target) : 50;
      }

      return { penalty, candidateRolls };
    };

    let groups = originalGroups;
    let best = evaluate(groups);

    for (let frameIndex = 0; frameIndex < Math.min(9, groups.length); frameIndex++) {
      const frameNo = frameIndex + 1;
      const candidates = getCandidates(frameNo, groups[frameIndex]);

      for (const candidate of candidates) {
        const nextGroups = groups.map((group, index) => (index === frameIndex ? candidate : group));
        const result = evaluate(nextGroups);

        if (result.penalty < best.penalty) {
          best = result;
          groups = nextGroups;
        }
      }
    }

    return best.candidateRolls.slice(0, 21);
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

      const cumulativeScores = getCumulativeScoresFromData(data);
      const frameBasedRolls = normalizeGeminiRollsFromFrames(data.frames, data.rolls);
      const scoreCheckedRolls = repairGeminiFramesByCumulativeScores(
        data.frames,
        frameBasedRolls,
        cumulativeScores
      );
      const repairedRolls = repairTenthFrameRolls(
        scoreCheckedRolls,
        data.frames,
        data.finalScore,
        cumulativeScores
      );
      const previewFrames = calcBowlingScore(repairedRolls).frames;

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

    const nextResult = calcBowlingScore(nextRolls);
    const roomPlayerName = getPlayerNameForRoom(playerName, user);

    saveLiveRoomDraft({
      roomId,
      userId: user.id,
      rolls: nextRolls,
      pinFrames,
    });

    const optimisticScore = {
      room_id: roomId,
      user_id: user.id,
      player_name: roomPlayerName,
      total: nextResult.total,
      rolls: nextRolls,
      frames: nextResult.frames,
      updated_at: new Date().toISOString(),
    };

    setLiveSyncStatus("자동 저장 중...");
    setRoomScores((prev) => {
      const others = prev.filter((score) => score.user_id !== user.id);
      return [optimisticScore, ...others];
    });

    const client = await getSupabaseClient();
    if (!client) {
      setLiveSyncStatus("로컬 임시저장됨");
      return;
    }

    try {
      await upsertRoomScore(client, {
        roomId,
        userId: user.id,
        playerName: roomPlayerName,
        rolls: nextRolls,
        frames: nextResult.frames,
        total: nextResult.total,
      });
      setLiveSyncStatus("자동 저장됨");
    } catch (error) {
      console.error("Live room score sync failed:", error);
      setLiveSyncStatus("동기화 실패 - 로컬 보관됨");
    }
  };

  useEffect(() => {
    if (appMode !== "room" || !roomId || !user) return;

    async function syncRoomPlayerName() {
      const client = await getSupabaseClient();
      if (!client) return;

      const roomPlayerName = getPlayerNameForRoom(playerName, user);
      await joinRoomById(client, {
        roomId,
        userId: user.id,
        playerName: roomPlayerName,
      });

      setRoomPlayers((prev) => {
        const others = prev.filter((player) => player.user_id !== user.id);
        return [...others, { room_id: roomId, user_id: user.id, player_name: roomPlayerName }];
      });
    }

    syncRoomPlayerName();
  }, [playerName, appMode, roomId, user?.id]);

  useEffect(() => {
    if (appMode !== "room" || !roomId || !user) return;
    if (!liveRoomReadyRef.current) return;
    syncRoomScoreLive(rolls);
  }, [rolls, pinFrames, playerName, appMode, roomId, user?.id]);

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
            <p>{getUserEmail(user)}</p>
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

          {appMode === "room" && liveSyncStatus && (
            <p className="liveSyncStatus">{liveSyncStatus}</p>
          )}
        </section>

        {isCameraModalOpen && (
          <OCRModal
            scoreImage={scoreImage}
            scoreImagePreviewUrl={scoreImagePreviewUrl}
            cropMode={cropMode}
            cropBox={cropBox}
            currentCropBox={currentCropBox}
            setCropMode={setCropMode}
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
            betAmount={roomBetAmount}
            betRule={roomBetRule}
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
