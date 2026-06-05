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

export async function upsertRoomScore(client, { roomId, userId, playerName, rolls, frames, total }) {
  if (!roomId || !userId) return;

  const { error } = await client.from("bowling_room_scores").upsert(
    {
      room_id: roomId,
      user_id: userId,
      player_name: playerName || "게스트",
      rolls,
      frames,
      total,
    },
    { onConflict: "room_id,user_id" }
  );

  if (error) throw error;
}
