export function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export function normalizeRoomCode(roomCode) {
  return String(roomCode || "").trim().replace(/\D/g, "").slice(0, 6);
}

async function roomCodeExists(client, roomCode) {
  const normalizedCode = normalizeRoomCode(roomCode);
  if (normalizedCode.length !== 6) return true;

  const { data, error } = await client
    .from("bowling_rooms")
    .select("id")
    .eq("room_code", normalizedCode)
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0;
}

async function generateUnusedRoomCode(client, maxAttempts = 30) {
  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const roomCode = generateRoomCode();
    // 이전 방 기록이 남아 있어도 같은 6자리 코드는 재사용하지 않는다.
    // 그래야 방 참여 시 예전 방과 새 방이 섞이지 않는다.
    // DB에 unique index가 있으면 동시 생성까지 더 안전하게 막을 수 있다.
    // 앱 단에서도 먼저 중복을 피해서 사용자가 겪는 충돌을 줄인다.
    //
    // 참고: bowling_rooms.room_code가 기존 데이터에 중복으로 남아 있으면
    // findRoomByCode는 최신 방 하나를 선택하도록 아래에서 방어한다.
    // 신규 생성은 여기서 중복을 피한다.
    //
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

  const { data: rooms, error } = await client
    .from("bowling_rooms")
    .select("*")
    .eq("room_code", normalizedCode)
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) throw error;
  const room = Array.isArray(rooms) ? rooms[0] : null;
  if (!room) throw new Error("방을 찾을 수 없습니다.");
  return room;
}


export async function findRoomById(client, roomId) {
  const { data: room, error } = await client
    .from("bowling_rooms")
    .select("*")
    .eq("id", roomId)
    .single();

  if (error) throw error;
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
