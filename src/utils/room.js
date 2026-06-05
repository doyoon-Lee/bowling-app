export function generateRoomCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createRoom(client, { roomName, ownerId, playerName, betAmount = 0, betRule = null }) {
  const roomCode = generateRoomCode();

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
  const normalizedCode = roomCode.trim().replace(/\D/g, "");

  const { data: room, error } = await client
    .from("bowling_rooms")
    .select("*")
    .eq("room_code", normalizedCode)
    .single();

  if (error) throw error;
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
