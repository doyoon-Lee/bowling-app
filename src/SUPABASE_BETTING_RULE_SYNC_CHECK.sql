-- Betting rule sync check
-- Run this in Supabase SQL Editor.

alter table bowling_rooms
add column if not exists bet_amount integer default 0;

alter table bowling_rooms
add column if not exists bet_rule jsonb default '{"mode":"none","baseAmount":0,"customRules":[]}'::jsonb;

alter table bowling_room_results
add column if not exists bet_amount integer default 0;

alter table bowling_room_results
add column if not exists bet_rule jsonb default '{"mode":"none","baseAmount":0,"customRules":[]}'::jsonb;

alter table bowling_room_results
add column if not exists settlement jsonb default '[]'::jsonb;

-- 최근 방의 내기 설정 확인용
select id, room_code, bet_amount, bet_rule, created_at
from bowling_rooms
order by created_at desc
limit 10;
