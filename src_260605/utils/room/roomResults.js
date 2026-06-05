// Room results helper
// Required Supabase table: bowling_room_results
//
// 역할 분리:
// - 개인 저장: 기존 날짜별 기록 저장
// - 방 종료/결과 보관: saveRoomResultSnapshot()
// - 완료된 방 결과 조회: fetchRoomResults()

import { supabase } from "../../lib/supabaseClient";

export async function saveRoomResultSnapshot({ roomId, roomCode, players }) {
  if (!roomId || !roomCode) {
    throw new Error("roomId and roomCode are required");
  }

  const resultData = {
    players: Array.isArray(players) ? players : [],
    savedAt: new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("bowling_room_results")
    .insert({
      room_id: roomId,
      room_code: roomCode,
      result_data: resultData
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function fetchRoomResults(roomId) {
  if (!roomId) return [];

  const { data, error } = await supabase
    .from("bowling_room_results")
    .select("*")
    .eq("room_id", roomId)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return data ?? [];
}
