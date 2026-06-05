export function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function normalizeRoomCode(roomCode) {
  return String(roomCode || "").trim().replace(/\D/g, "").slice(0, 6);
}

export function getRoomDayKey(date = new Date()) {
  // 방 번호는 한국 시간 기준으로 하루 단위만 유효하게 본다.
  // 예전 날짜의 같은 6자리 방 번호가 DB에 남아 있어도 오늘 방과 섞이지 않게 한다.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function getRoomDayBounds(date = new Date()) {
  const [year, month, day] = getRoomDayKey(date).split("-").map(Number);
  const startUtc = new Date(Date.UTC(year, month - 1, day, -9, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month - 1, day + 1, -9, 0, 0, 0));

  return {
    dayKey: getRoomDayKey(date),
    startIso: startUtc.toISOString(),
    endIso: endUtc.toISOString(),
  };
}

export function isRoomFromToday(room, date = new Date()) {
  if (!room?.created_at) return false;

  const createdAt = new Date(room.created_at).getTime();
  const { startIso, endIso } = getRoomDayBounds(date);
  return createdAt >= new Date(startIso).getTime() && createdAt < new Date(endIso).getTime();
}

async function roomCodeExists(client, roomCode) {
  const normalizedCode = normalizeRoomCode(roomCode);
  if (normalizedCode.length !== 6) return true;

  const { startIso, endIso } = getRoomDayBounds();
  const { data, error } = await client
    .from("bowling_rooms")
    .select("id")
    .eq("room_code", normalizedCode)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function generateUnusedRoomCode(client, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const roomCode = generateRoomCode();
    // 같은 날짜 안에서만 6자리 방 번호 중복을 피한다.
    // 어제 이전 방 데이터가 DB에 남아 있어도 오늘 새 방 생성/입장과 섞이지 않는다.
    // 6자리 숫자는 90만 개라 일반 사용량에서는 30회 내 성공 가능성이 매우 높다.
    // 실패하면 Supabase 에러가 아니라 명확한 안내 에러를 던진다.
    //
    // eslint-disable-next-line no-await-in-loop
    const exists = await roomCodeExists(client, roomCode);
    if (!exists) return roomCode;
  }

  throw new Error("사용 가능한 방 번호를 만들지 못했습니다. 잠시 후 다시 시도해주세요.");
}

export async function createRoom(client, { roomName, ownerId, playerName, betAmount = 0, betRule = null }) {
  const roomCode = await generateUnusedRoomCode(client);

  const { data: room, error } = await client
    .from("bowling_rooms")
    .insert({
      room_code: roomCode,
      room_name: roomName || `${playerName || "사용자"}의 방`,
      owner_id: ownerId,
      bet_amount: Math.max(0, Number(betAmount || 0)),
      bet_rule: betRule,
    })
    .select("*")
    .single();

  if (error) throw error;

  await joinRoomById(client, {
    roomId: room.id,
    userId: ownerId,
    playerName,
  });

  return room;
}

export async function findRoomByCode(client, roomCode) {
  const normalizedCode = normalizeRoomCode(roomCode);
  if (normalizedCode.length !== 6) {
    throw new Error("6자리 방 코드를 입력해주세요.");
  }

  const { startIso, endIso } = getRoomDayBounds();
  const { data: rooms, error } = await client
    .from("bowling_rooms")
    .select("*")
    .eq("room_code", normalizedCode)
    .gte("created_at", startIso)
    .lt("created_at", endIso)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const room = Array.isArray(rooms) ? rooms[0] : null;
  if (!room) throw new Error("오늘 생성된 방을 찾을 수 없습니다.");
  return room;
}


export async function findRoomById(client, roomId) {
  const { data: room, error } = await client
    .from("bowling_rooms")
    .select("*")
    .eq("id", roomId)
    .maybeSingle();

  if (error) throw error;
  if (!room || !isRoomFromToday(room)) return null;
  return room;
}

export async function joinRoomById(client, { roomId, userId, playerName }) {
  const { error } = await client.from("bowling_room_players").upsert(
    {
      room_id: roomId,
      user_id: userId,
      player_name: playerName || "게스트",
    },
    { onConflict: "room_id,user_id" }
  );

  if (error) throw error;
}

export async function upsertRoomScore(client, { roomId, userId, playerName, rolls, frames, total, roundCompleted = false, currentRound = 1 }) {
  if (!roomId || !userId) return;

  const { error } = await client.from("bowling_room_scores").upsert(
    {
      room_id: roomId,
      user_id: userId,
      player_name: playerName || "게스트",
      rolls,
      frames,
      total,
      round_completed: Boolean(roundCompleted),
      current_round: Number(currentRound || 1),
    },
    { onConflict: "room_id,user_id" }
  );

  if (error) throw error;
}


export async function deleteRoomPlayerScore(client, { roomId, userId, currentRound }) {
  if (!roomId || !userId) return;

  let query = client
    .from("bowling_room_scores")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (currentRound) {
    query = query.eq("current_round", Number(currentRound));
  }

  const { error } = await query;
  if (error) throw error;
}

export async function saveRoomGameRound(client, { roomId, roomCode, roundNumber, players, scores, betRule, settlement }) {
  if (!roomId || !roomCode) return null;

  const { data, error } = await client
    .from("bowling_room_results")
    .insert({
      room_id: roomId,
      room_code: roomCode,
      round_number: roundNumber,
      result_data: {
        players,
        scores,
      },
      bet_amount: Number(betRule?.baseAmount || 0),
      bet_rule: betRule || null,
      settlement: settlement || [],
    })
    .select("*")
    .single();

  if (error) throw error;
  return data;
}

export async function fetchRoomGameRounds(client, roomId) {
  if (!roomId) return [];

  const { data, error } = await client
    .from("bowling_room_results")
    .select("*")
    .eq("room_id", roomId)
    .order("round_number", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function clearRoomScores(client, roomId) {
  if (!roomId) return;

  const { error } = await client
    .from("bowling_room_scores")
    .delete()
    .eq("room_id", roomId);

  if (error) throw error;
}

export async function leaveRoomById(client, { roomId, userId }) {
  if (!roomId || !userId) return;

  const { error } = await client
    .from("bowling_room_players")
    .delete()
    .eq("room_id", roomId)
    .eq("user_id", userId);

  if (error) throw error;

  await removeEmptyRoom(client, roomId);
}

export async function removeEmptyRoom(client, roomId) {
  if (!roomId) return false;

  const { count, error: countError } = await client
    .from("bowling_room_players")
    .select("id", { count: "exact", head: true })
    .eq("room_id", roomId);

  if (countError) throw countError;

  if ((count || 0) > 0) return false;

  const { error: deleteError } = await client
    .from("bowling_rooms")
    .delete()
    .eq("id", roomId);

  if (deleteError) throw deleteError;

  return true;
}
