-- Multi-game room settlement update
-- Run this in Supabase SQL Editor.

alter table bowling_room_results
add column if not exists round_number integer default 1;

alter table bowling_room_results
add column if not exists bet_amount integer default 0;

alter table bowling_room_results
add column if not exists bet_rule jsonb default '{"mode":"none","baseAmount":0,"customRules":[]}'::jsonb;

alter table bowling_room_results
add column if not exists settlement jsonb default '[]'::jsonb;

create index if not exists bowling_room_results_room_round_idx
on bowling_room_results(room_id, round_number);

alter table bowling_room_results replica identity full;

-- Already added면 "already member of publication" 에러가 날 수 있습니다. 그 경우 무시하세요.
alter publication supabase_realtime add table bowling_room_results;
