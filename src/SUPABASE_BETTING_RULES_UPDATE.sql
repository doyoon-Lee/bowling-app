-- Betting rule extension for live bowling rooms
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

-- Optional but recommended for Realtime updates.
alter table bowling_rooms replica identity full;
alter table bowling_room_results replica identity full;

-- If these are already enabled, Supabase may show
-- "relation is already member of publication"; that is safe to ignore.
alter publication supabase_realtime add table bowling_rooms;
alter publication supabase_realtime add table bowling_room_results;
