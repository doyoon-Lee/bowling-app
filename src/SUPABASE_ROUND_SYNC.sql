-- Round sync update
-- Run this in Supabase SQL Editor if bowling_room_results Realtime is not already enabled.

alter table bowling_room_results replica identity full;
alter table bowling_room_scores replica identity full;

-- 이미 publication에 추가되어 있으면 아래 문장은 에러가 날 수 있습니다. 그 경우 무시하세요.
alter publication supabase_realtime add table bowling_room_results;
alter publication supabase_realtime add table bowling_room_scores;
