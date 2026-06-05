# 실시간 방 결과 보관 수정 안내

Supabase에 bowling_room_results 테이블을 추가한 뒤, 프론트에서는 아래 흐름을 연결해야 합니다.

1. 기존 '저장' 버튼은 개인 날짜별 기록 저장만 수행합니다.
2. 실시간 방은 저장 후에도 유지합니다.
3. 방장 또는 참가자가 '게임 종료/결과 저장'을 누르면 현재 room players/scores를 모아
   bowling_room_results에 스냅샷으로 저장합니다.
4. 완료된 게임은 fetchRoomResults(roomId)로 다시 조회할 수 있습니다.

추가된 파일:
- src/utils/room/roomResults.js
