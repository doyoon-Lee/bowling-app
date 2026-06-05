-- Room save guard / per-round completion update
-- Run this in Supabase SQL Editor.

alter table bowling_room_scores
add column if not exists round_completed boolean default false;

alter table bowling_room_scores
add column if not exists current_round integer default 1;

alter table bowling_rooms
add column if not exists current_round integer default 1;

alter table bowling_room_results
add column if not exists round_number integer default 1;

create index if not exists bowling_room_scores_room_round_idx
on bowling_room_scores(room_id, current_round);

create index if not exists bowling_room_results_room_round_idx
on bowling_room_results(room_id, round_number);

alter table bowling_room_scores replica identity full;
alter table bowling_room_results replica identity full;

-- 이미 publication에 추가되어 있으면 에러가 날 수 있습니다. 그 경우 무시하세요.
alter publication supabase_realtime add table bowling_room_scores;
alter publication supabase_realtime add table bowling_room_results;
